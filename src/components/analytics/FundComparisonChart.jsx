import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FUND_COLORS = {
  'G Fund': '#6366f1', 'F Fund': '#8b5cf6', 'C Fund': '#22c55e',
  'S Fund': '#3b82f6', 'I Fund': '#f59e0b', 'L Income': '#ec4899',
  'L 2025': '#06b6d4', 'L 2030': '#10b981', 'L 2035': '#f97316',
  'L 2040': '#84cc16', 'L 2045': '#eab308', 'L 2050': '#ef4444',
  'L 2055': '#a855f7', 'L 2060': '#14b8a6', 'L 2065': '#f43f5e',
  'Portfolio': '#C9A832',
};

const PERIODS = [
  { label: 'WTD', key: 'wtd' },
  { label: 'MTD', key: 'mtd' },
  { label: 'YTD', key: 'ytd' },
  { label: '1Y', key: '1y' },
  { label: 'All', key: 'all' },
];

export default function FundComparisonChart({ profile, selectedFunds }) {
  const [period, setPeriod] = useState('ytd');

  const { data: snapshots = [] } = useQuery({
    queryKey: ['fund-snapshots-all', profile?.id],
    queryFn: () => base44.entities.FundDailySnapshot.filter({ profile_id: profile.id }),
    enabled: !!profile?.id,
  });

  const { data: dailyBalances = [] } = useQuery({
    queryKey: ['daily-balances', profile?.id],
    queryFn: () => base44.entities.DailyBalance.filter({ profile_id: profile.id }, '-date', 500),
    enabled: !!profile?.id,
  });

  const chartData = useMemo(() => {
    if (!snapshots.length && !selectedFunds.length) return [];

    const now = new Date();
    let cutoff = new Date(0);

    if (period === 'wtd') {
      const dow = now.getDay();
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
    } else if (period === 'mtd') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'ytd') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    } else if (period === '1y') {
      cutoff = new Date(now);
      cutoff.setFullYear(now.getFullYear() - 1);
    }

    const cutoffStr = cutoff.toISOString().split('T')[0];

    // Build date → { fundName: ytd% } map
    const dateMap = {};

    // For each fund, normalize % return relative to cutoff date's price
    const fundNames = [...new Set(snapshots.map(s => s.fund_name))];

    for (const fundName of fundNames) {
      if (!selectedFunds.find(f => f.fund_name === fundName)) continue;
      const fundSnaps = snapshots
        .filter(s => s.fund_name === fundName && s.date >= cutoffStr)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (!fundSnaps.length) continue;
      const basePrice = fundSnaps[0].share_price || 1;
      for (const snap of fundSnaps) {
        if (!dateMap[snap.date]) dateMap[snap.date] = { date: snap.date };
        const ret = basePrice > 0 ? ((snap.share_price - basePrice) / basePrice) * 100 : 0;
        dateMap[snap.date][fundName] = parseFloat(ret.toFixed(3));
      }
    }

    // Portfolio line from daily balances
    const balancesInPeriod = dailyBalances
      .filter(b => b.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (balancesInPeriod.length > 0) {
      const baseBalance = balancesInPeriod[0].balance || 1;
      for (const b of balancesInPeriod) {
        if (!dateMap[b.date]) dateMap[b.date] = { date: b.date };
        dateMap[b.date]['Portfolio'] = parseFloat(((b.balance - baseBalance) / baseBalance * 100).toFixed(3));
      }
    }

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots, dailyBalances, period, selectedFunds]);

  const activeLines = useMemo(() => {
    const names = new Set();
    chartData.forEach(d => Object.keys(d).forEach(k => k !== 'date' && names.add(k)));
    return [...names];
  }, [chartData]);

  if (!snapshots.length && !dailyBalances.length) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-xs text-muted-foreground text-center py-6">
          Fund comparison data will appear after the first nightly price update.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold">Fund Comparison</h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                period === p.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => v.toFixed(1) + '%'} width={40} />
          <Tooltip
            formatter={(v, name) => [v.toFixed(2) + '%', name]}
            contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 10 }}
            labelFormatter={v => v}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          {activeLines.map(name => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={FUND_COLORS[name] || '#888'}
              strokeWidth={name === 'Portfolio' ? 2.5 : 1.5}
              strokeDasharray={name === 'Portfolio' ? '5 3' : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
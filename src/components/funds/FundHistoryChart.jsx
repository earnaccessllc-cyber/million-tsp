import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import YTDBadge from '@/components/dashboard/YTDBadge';

const PERIODS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 99999 },
];

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);
const fmtShort = n => '$' + (n / 1000).toFixed(1) + 'k';

export default function FundHistoryChart({ fund, profile }) {
  const [period, setPeriod] = useState('1Y');

  const { data: snapshots = [] } = useQuery({
    queryKey: ['fund-snapshots', profile?.id, fund?.fund_name],
    queryFn: () => base44.entities.FundDailySnapshot.filter({ profile_id: profile.id, fund_name: fund.fund_name }),
    enabled: !!profile?.id && !!fund?.fund_name,
  });

  const filtered = useMemo(() => {
    const days = PERIODS.find(p => p.label === period)?.days || 365;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return [...snapshots]
      .filter(s => days >= 99999 || s.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [snapshots, period]);

  const exportCSV = () => {
    const rows = [
      ['Date', 'Share Price', 'Shares', 'Balance', 'Daily Change %', 'WTD %', 'MTD %', 'YTD %'].join(','),
      ...snapshots.sort((a, b) => a.date.localeCompare(b.date)).map(s =>
        [s.date, s.share_price, s.shares, s.balance, s.daily_change_percent, s.wtd_percent, s.mtd_percent, s.ytd_percent].join(',')
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fund.fund_name.replace(/ /g, '_')}_history.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!fund) return null;

  const latest = filtered[filtered.length - 1];

  return (
    <div className="space-y-3">
      {/* Performance summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <PerfCard label="WTD" value={fund.wtd_return_percent} />
        <PerfCard label="MTD" value={fund.mtd_return_percent} />
        <PerfCard label="YTD" value={fund.return_percent} />
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.label)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                period === p.label ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {snapshots.length > 0 && (
          <button onClick={exportCSV} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
            <Download className="w-3 h-3" />CSV
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No historical data yet. Data is recorded automatically each night after market close.
        </div>
      ) : (
        <>
          {/* Share Price Chart */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Share Price</p>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={filtered}>
                <defs>
                  <linearGradient id={`sg_${fund.fund_name}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A832" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A832" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => '$' + v.toFixed(2)} width={42} domain={['auto', 'auto']} />
                <Tooltip formatter={v => [fmt(v), 'Price']} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 6, fontSize: 10 }} labelFormatter={v => v} />
                <Area type="monotone" dataKey="share_price" stroke="#C9A832" fill={`url(#sg_${fund.fund_name})`} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Balance Chart */}
          {filtered.some(s => s.balance > 0) && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">My Balance in {fund.fund_name}</p>
              <ResponsiveContainer width="100%" height={100}>
                <AreaChart data={filtered}>
                  <defs>
                    <linearGradient id={`bg_${fund.fund_name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8, fill: '#888' }} tickFormatter={fmtShort} width={36} domain={['auto', 'auto']} />
                  <Tooltip formatter={v => [fmt(v), 'Balance']} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 6, fontSize: 10 }} labelFormatter={v => v} />
                  <Area type="monotone" dataKey="balance" stroke="#3b82f6" fill={`url(#bg_${fund.fund_name})`} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Shares Chart */}
          {filtered.some(s => s.shares > 0) && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Shares Accumulated</p>
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={filtered}>
                  <defs>
                    <linearGradient id={`shares_${fund.fund_name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#888' }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 8, fill: '#888' }} width={36} domain={['auto', 'auto']} />
                  <Tooltip formatter={v => [v?.toFixed(3), 'Shares']} contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 6, fontSize: 10 }} labelFormatter={v => v} />
                  <Area type="monotone" dataKey="shares" stroke="#22c55e" fill={`url(#shares_${fund.fund_name})`} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PerfCard({ label, value }) {
  const isPos = (value || 0) >= 0;
  return (
    <div className="bg-muted/40 rounded-lg p-2 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold ${isPos ? 'text-gain' : 'text-loss'}`}>
        {isPos ? '+' : ''}{(value || 0).toFixed(2)}%
      </p>
    </div>
  );
}
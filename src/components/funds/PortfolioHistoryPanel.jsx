import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/tspFunds';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function PortfolioHistoryPanel({ funds, dailyBalances, showExtended }) {
  const { isPro } = useProStatus();
  const [period, setPeriod] = useState('1M');

  if (showExtended && !isPro) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Fund Price History</h3>
        <ProGate feature="advanced_fund_history" />
      </div>
    );
  }

  // Build chart data from daily balances
  const sorted = [...(dailyBalances || [])].sort((a, b) => new Date(a.date) - new Date(b.date));

  const now = new Date();
  const cutoffs = {
    '1W': new Date(now - 7 * 86400000),
    '1M': new Date(now - 30 * 86400000),
    '3M': new Date(now - 90 * 86400000),
    '6M': new Date(now - 180 * 86400000),
    '1Y': new Date(now - 365 * 86400000),
  };
  const periods = ['1W', '1M', '3M', '6M', '1Y'];
  if (showExtended) periods.push('ALL');

  const cutoff = cutoffs[period] || new Date(0);
  const filtered = sorted.filter(d => new Date(d.date) >= cutoff);

  const chartData = filtered.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    balance: d.balance || 0,
  }));

  // Fund price table
  const fundsWithPrices = funds.filter(f => f.share_price > 0);

  return (
    <div className="space-y-4">
      {/* Portfolio Balance Chart */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Portfolio Balance</h3>
          <div className="flex gap-1">
            {periods.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                  period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                formatter={v => [formatCurrency(v), 'Balance']}
              />
              <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            No balance history yet. Refresh prices to start tracking.
          </div>
        )}
      </div>

      {/* Fund Prices Table */}
      {fundsWithPrices.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold mb-3">Current Fund Prices</h3>
          <div className="space-y-2">
            {fundsWithPrices.map((fund, i) => {
              const chg = fund.previous_share_price > 0
                ? ((fund.share_price - fund.previous_share_price) / fund.previous_share_price * 100) : 0;
              return (
                <div key={fund.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium text-foreground">{fund.fund_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-sm font-mono">${fund.share_price.toFixed(4)}</span>
                    <span className={`text-xs font-medium flex items-center gap-0.5 ${chg >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {chg >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(chg).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
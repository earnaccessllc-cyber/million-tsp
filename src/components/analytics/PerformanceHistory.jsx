import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChevronDown, ChevronRight, Trophy, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n, showPlus = true) => (showPlus && n >= 0 ? '+' : '') + (n || 0).toFixed(2) + '%';

export default function PerformanceHistory({ profile, dailyBalances }) {
  const [expandedYear, setExpandedYear] = useState(null);

  const { data: annualSummaries = [] } = useQuery({
    queryKey: ['annual-summaries', profile?.id],
    queryFn: () => base44.entities.AnnualSummary.filter({ profile_id: profile.id }),
    enabled: !!profile?.id,
  });

  // Account-level summaries only (fund_name empty or null)
  const accountSummaries = annualSummaries
    .filter(s => !s.fund_name)
    .sort((a, b) => b.year - a.year);

  // All-time stats from daily balances
  const sorted = [...dailyBalances].sort((a, b) => new Date(a.date) - new Date(b.date));
  const allTimeGain = sorted.length >= 2 ? sorted[sorted.length - 1].balance - sorted[0].balance : 0;
  const bestDay = dailyBalances.reduce((best, d) => (!best || d.daily_change_percent > best.daily_change_percent) ? d : best, null);
  const worstDay = dailyBalances.reduce((worst, d) => (!worst || d.daily_change_percent < worst.daily_change_percent) ? d : worst, null);
  const bestYear = accountSummaries.length ? accountSummaries.reduce((b, s) => s.annual_return_percent > b.annual_return_percent ? s : b, accountSummaries[0]) : null;
  const worstYear = accountSummaries.length ? accountSummaries.reduce((b, s) => s.annual_return_percent < b.annual_return_percent ? s : b, accountSummaries[0]) : null;
  const avgAnnual = accountSummaries.length ? accountSummaries.reduce((s, y) => s + y.annual_return_percent, 0) / accountSummaries.length : null;

  // Chart data — monthly averages for balance growth
  const monthlyData = (() => {
    const map = {};
    for (const d of sorted) {
      const key = d.date?.slice(0, 7);
      if (key) map[key] = { month: key, balance: d.balance };
    }
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
  })();

  // Milestone markers
  const milestones = [100000, 250000, 500000, 750000, 1000000];

  return (
    <div className="space-y-4">

      {/* All-Time Stats */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" />All-Time Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Total $ Gained" value={fmt(allTimeGain)} color={allTimeGain >= 0 ? 'text-gain' : 'text-loss'} />
          <StatTile label="Years Tracked" value={String(accountSummaries.length || 1)} />
          {bestYear && <StatTile label="Best Year" value={`${bestYear.year} (${fmtPct(bestYear.annual_return_percent)})`} color="text-gain" />}
          {worstYear && <StatTile label="Worst Year" value={`${worstYear.year} (${fmtPct(worstYear.annual_return_percent)})`} color="text-loss" />}
          {avgAnnual !== null && <StatTile label="Avg Annual Return" value={fmtPct(avgAnnual)} color={avgAnnual >= 0 ? 'text-gain' : 'text-loss'} />}
          {bestDay && <StatTile label="Best Day" value={`${fmtPct(bestDay.daily_change_percent)} on ${new Date(bestDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} color="text-gain" />}
          {worstDay && <StatTile label="Worst Day" value={`${fmtPct(worstDay.daily_change_percent)} on ${new Date(worstDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} color="text-loss" />}
        </div>
      </div>

      {/* Balance Growth Chart */}
      {monthlyData.length > 1 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-bold mb-3">Balance Growth</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#888' }} tickFormatter={v => v.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: '#888' }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} width={40} />
              <Tooltip
                formatter={(v) => [fmt(v), 'Balance']}
                contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 8, fontSize: 11 }}
                labelFormatter={v => v}
              />
              {milestones.map(m => (
                <ReferenceLine key={m} y={m} stroke="#C9A832" strokeDasharray="3 3" strokeOpacity={0.3}
                  label={{ value: '$' + (m / 1000) + 'k', position: 'insideRight', fontSize: 8, fill: '#C9A832' }}
                />
              ))}
              <Line type="monotone" dataKey="balance" stroke="#C9A832" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Year-Over-Year Table */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-bold mb-3">Year-Over-Year Summary</h3>
        {accountSummaries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Annual summaries are generated automatically on December 31st each year. Check back then!
          </p>
        ) : (
          <div className="space-y-2">
            {accountSummaries.map(summary => {
              const isExpanded = expandedYear === summary.year;
              const isPos = summary.annual_return_percent >= 0;
              // Fund summaries for this year
              const fundSummaries = annualSummaries.filter(s => s.year === summary.year && s.fund_name);
              return (
                <div key={summary.year} className="rounded-lg border border-border overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    onClick={() => setExpandedYear(isExpanded ? null : summary.year)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className="text-sm font-bold">{summary.year}</span>
                      <span className={`text-sm font-bold ${isPos ? 'text-gain' : 'text-loss'}`}>
                        {fmtPct(summary.annual_return_percent)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-foreground font-medium">{fmt(summary.closing_balance)}</p>
                      <p className={`text-[10px] ${isPos ? 'text-gain' : 'text-loss'}`}>
                        {isPos ? '+' : ''}{fmt(summary.gain_loss_dollars)}
                      </p>
                    </div>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-3 border-t border-border">
                          {/* Account breakdown */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <MiniStat label="Opening" value={fmt(summary.opening_balance)} />
                            <MiniStat label="Closing" value={fmt(summary.closing_balance)} />
                            <MiniStat label="Gain Days" value={String(summary.gain_days || 0)} />
                            <MiniStat label="Loss Days" value={String(summary.loss_days || 0)} />
                            {summary.best_day_date && <MiniStat label="Best Day" value={`${fmtPct(summary.best_day_gain)} (${new Date(summary.best_day_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`} color="text-gain" />}
                            {summary.worst_day_date && <MiniStat label="Worst Day" value={`${fmtPct(summary.worst_day_loss)} (${new Date(summary.worst_day_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`} color="text-loss" />}
                            {summary.total_contributions > 0 && <MiniStat label="Contributions" value={fmt(summary.total_contributions)} />}
                          </div>
                          {/* Fund breakdown for this year */}
                          {fundSummaries.length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Fund Returns</p>
                              <div className="space-y-1">
                                {fundSummaries.sort((a, b) => b.annual_return_percent - a.annual_return_percent).map(f => (
                                  <div key={f.fund_name} className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">{f.fund_name}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[10px] text-muted-foreground">{fmt(f.closing_balance)}</span>
                                      <span className={`text-xs font-semibold ${f.annual_return_percent >= 0 ? 'text-gain' : 'text-loss'}`}>
                                        {fmtPct(f.annual_return_percent)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, color = 'text-foreground' }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2.5">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xs font-bold truncate ${color}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value, color = 'text-foreground' }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold ${color}`}>{value}</p>
    </div>
  );
}
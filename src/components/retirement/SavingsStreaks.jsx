import React from 'react';
import { Flame, Trophy, TrendingDown } from 'lucide-react';

export default function SavingsStreaks({ dailyBalances }) {
  const sorted = [...dailyBalances]
    .filter(d => d.daily_change !== undefined && d.daily_change !== null)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sorted.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
        No balance history yet. Refresh prices to start tracking streaks.
      </div>
    );
  }

  // Current streak (from most recent)
  let currentStreak = 0;
  for (const d of sorted) {
    if (d.is_gain) currentStreak++;
    else break;
  }

  // Best streak
  let bestStreak = 0, temp = 0;
  for (const d of [...sorted].reverse()) {
    if (d.is_gain) { temp++; bestStreak = Math.max(bestStreak, temp); } else temp = 0;
  }

  const isOnStreak = currentStreak > 0;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold">Savings Streaks</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className={`rounded-xl p-4 text-center ${isOnStreak ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-muted'}`}>
          <div className="text-3xl mb-1">{isOnStreak ? '🔥' : '💤'}</div>
          <p className="text-2xl font-bold">{currentStreak}</p>
          <p className="text-xs text-muted-foreground">Current Streak</p>
          {isOnStreak && <p className="text-xs text-orange-400 font-medium mt-1">Keep it up!</p>}
        </div>
        <div className="bg-muted rounded-xl p-4 text-center">
          <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
          <p className="text-2xl font-bold">{bestStreak}</p>
          <p className="text-xs text-muted-foreground">Personal Best</p>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium mb-2">Last 14 days</p>
        <div className="flex gap-1 flex-wrap">
          {sorted.slice(0, 14).reverse().map((d, i) => (
            <div
              key={i}
              title={`${d.date}: ${d.daily_change >= 0 ? '+' : ''}${(d.daily_change || 0).toFixed(0)}`}
              className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] ${
                d.is_gain ? 'bg-gain/20 text-gain' : 'bg-loss/20 text-loss'
              }`}
            >
              {d.is_gain ? '▲' : '▼'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
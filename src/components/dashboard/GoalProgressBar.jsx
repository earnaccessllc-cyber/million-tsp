import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { projectGoalFromProfile, formatGoalDate } from '@/lib/goalProjection';

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export default function GoalProgressBar({ currentBalance, balanceGoal, profile }) {
  const goal = balanceGoal || 1_000_000;
  const pct = Math.min((currentBalance / goal) * 100, 100);
  const remaining = Math.max(goal - currentBalance, 0);
  const isComplete = currentBalance >= goal;

  // Same projection the Retire tab's Goal Timeline runs, so both show one pace.
  const { monthlyContrib, contrib, annualReturn, date } = projectGoalFromProfile(profile, currentBalance, goal);
  const projectedDate = !isComplete ? formatGoalDate(date) : null;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal Progress</span>
        </div>
        <span className="text-sm font-bold text-primary">{pct.toFixed(1)}%</span>
      </div>

      {/* Bar */}
      <div className="bg-muted rounded-full h-2.5 mb-2.5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: isComplete
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #C9A832, #FFD700)',
          }}
        />
      </div>

      {/* Balance labels */}
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-foreground font-medium">{fmt(currentBalance)}</span>
        {isComplete ? (
          <span className="text-gain font-semibold">🏆 Goal reached!</span>
        ) : (
          <span className="text-muted-foreground">{fmt(remaining)} to go</span>
        )}
        <span className="text-muted-foreground">{fmt(goal)}</span>
      </div>

      {/* Projected date */}
      {projectedDate && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          {monthlyContrib > 0
            ? `📈 Projected to reach goal by ${projectedDate} (at ${annualReturn}% return + contributions${contrib.agency > 0 ? ' & agency match' : ''})`
            : `📈 Projected by ${projectedDate} at ${annualReturn}% annual return`}
        </p>
      )}
    </div>
  );
}
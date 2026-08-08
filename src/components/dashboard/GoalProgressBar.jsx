import React from 'react';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

function fmt(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function projectGoalDate(balance, goal, monthlyContrib, annualReturn = 9) {
  if (balance >= goal) return null; // already done
  const monthlyRate = annualReturn / 100 / 12;
  let bal = balance;
  let months = 0;
  while (bal < goal && months < 600) {
    bal = bal * (1 + monthlyRate) + monthlyContrib;
    months++;
  }
  if (months >= 600) return null;
  const target = new Date();
  target.setMonth(target.getMonth() + months);
  return target.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getMonthlyContrib(profile) {
  if (!profile) return 0;
  const periods = profile.pay_schedule === 'monthly' ? 12 : 26;
  const tradDollar = profile.contrib_traditional_mode === 'dollar'
    ? (profile.contrib_traditional_dollar || 0)
    : ((profile.contrib_traditional_percent || 0) / 100) * (profile.current_annual_salary || 0) / periods;
  const rothDollar = profile.contrib_roth_mode === 'dollar'
    ? (profile.contrib_roth_dollar || 0)
    : ((profile.contrib_roth_percent || 0) / 100) * (profile.current_annual_salary || 0) / periods;
  const perPeriod = tradDollar + rothDollar;
  return perPeriod * periods / 12;
}

export default function GoalProgressBar({ currentBalance, balanceGoal, profile }) {
  const goal = balanceGoal || 1_000_000;
  const pct = Math.min((currentBalance / goal) * 100, 100);
  const remaining = Math.max(goal - currentBalance, 0);
  const isComplete = currentBalance >= goal;

  const monthlyContrib = getMonthlyContrib(profile);
  const projectedDate = !isComplete ? projectGoalDate(currentBalance, goal, monthlyContrib) : null;

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
            ? `📈 Projected to reach goal by ${projectedDate} (at 9% return + contributions)`
            : `📈 Projected by ${projectedDate} at 9% annual return`}
        </p>
      )}
    </div>
  );
}
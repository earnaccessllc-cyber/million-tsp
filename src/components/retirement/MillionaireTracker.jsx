import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Zap } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { formatCurrency } from '@/lib/tspFunds';

function projectToGoal(balance, monthlyContrib, target, annualReturn = 7) {
  const monthlyRate = annualReturn / 100 / 12;
  let bal = balance;
  let months = 0;
  const TARGET = target;
  while (bal < TARGET && months < 600) {
    bal = bal * (1 + monthlyRate) + monthlyContrib;
    months++;
  }
  return { months, reached: bal >= TARGET };
}

export default function MillionaireTracker({ profile, tspBalance }) {
  const [extraPercent, setExtraPercent] = useState(0);
  const [extraDollar, setExtraDollar] = useState(0);
  const [whatIfMode, setWhatIfMode] = useState('percent'); // 'percent' | 'dollar'
  const [confetti, setConfetti] = useState(false);

  const GOAL = profile.balance_goal || 1_000_000;
  const salary = profile.current_annual_salary || 0;
  const baseMonthlyContrib = ((profile.traditional_contributions || 0) + (profile.roth_contributions || 0)) / 12;
  const bonusContrib = whatIfMode === 'percent'
    ? (salary * extraPercent / 100) / 12
    : extraDollar;
  const monthlyContrib = baseMonthlyContrib + bonusContrib;

  const base = projectToGoal(tspBalance, baseMonthlyContrib, GOAL);
  const boosted = projectToGoal(tspBalance, monthlyContrib, GOAL);

  const progress = Math.min((tspBalance / GOAL) * 100, 100);
  const isMillion = tspBalance >= GOAL;

  useEffect(() => {
    if (isMillion) {
      setConfetti(true);
      import('canvas-confetti').then(mod => {
        const confettiLib = mod.default;
        confettiLib({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
        setTimeout(() => confettiLib({ particleCount: 100, spread: 120, origin: { y: 0.6 } }), 500);
      });
    }
  }, [isMillion]);

  const formatMonths = (months) => {
    if (!months || months >= 600) return 'Goal not reachable';
    const y = Math.floor(months / 12);
    const m = months % 12;
    const target = new Date();
    target.setMonth(target.getMonth() + months);
    return `${y > 0 ? `${y}y ` : ''}${m}m — ${target.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  const monthlyNeeded = (() => {
    if (tspBalance >= GOAL) return 0;
    let lo = 0, hi = 100000;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const res = projectToGoal(tspBalance, mid, GOAL);
      if (res.months <= 360) hi = mid; else lo = mid;
    }
    return Math.ceil(lo);
  })();

  return (
    <div className="space-y-4">
      {/* Million badge */}
      {isMillion && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-2xl p-6 text-center"
        >
          <div className="text-5xl mb-2">🏆</div>
          <h2 className="text-2xl font-bold text-yellow-400">Goal Reached!</h2>
          <p className="text-sm text-muted-foreground mt-1">You've hit your {formatCurrency(GOAL)} goal!</p>
        </motion.div>
      )}

      {/* Progress */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold">Goal Progress</span>
          </div>
          <span className="text-sm font-bold text-primary">{progress.toFixed(1)}%</span>
        </div>
        <div className="bg-muted rounded-full h-3 mb-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400"
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(tspBalance)}</span>
          <span>{formatCurrency(Math.max(GOAL - tspBalance, 0))} to go</span>
          <span>{formatCurrency(GOAL)}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Current balance</p>
            <p className="font-bold text-foreground">{formatCurrency(tspBalance)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Remaining to goal</p>
            <p className="font-bold text-primary">{formatCurrency(Math.max(GOAL - tspBalance, 0))}</p>
          </div>
        </div>
      </div>

      {/* Projection */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold">Goal Timeline</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs text-muted-foreground mb-1">Current pace</p>
            <p className="text-xs font-semibold">{formatMonths(base.months)}</p>
          </div>
          {extraPercent > 0 && (
            <div className="bg-gain/10 border border-gain/20 rounded-xl p-3">
              <p className="text-xs text-gain mb-1">+{extraPercent}% more</p>
              <p className="text-xs font-semibold">{formatMonths(boosted.months)}</p>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Monthly contributions needed to reach {formatCurrency(GOAL)} in 30 years:</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(monthlyNeeded)}/mo</p>
        </div>
      </div>

      {/* What-if slider */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">What-If: Increase Contribution</span>
          </div>
          <div className="flex bg-muted rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setWhatIfMode('percent')}
              className={`px-2 py-1 rounded-md transition-colors ${whatIfMode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >%</button>
            <button
              onClick={() => setWhatIfMode('dollar')}
              className={`px-2 py-1 rounded-md transition-colors ${whatIfMode === 'dollar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >$</button>
          </div>
        </div>
        <div className="space-y-3">
          {whatIfMode === 'percent' ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Extra: <span className="text-foreground font-semibold">{extraPercent}% of salary</span></span>
                <span className="text-primary font-medium">+{formatCurrency(bonusContrib)}/mo</span>
              </div>
              <Slider
                min={0} max={10} step={1}
                value={[extraPercent]}
                onValueChange={([v]) => setExtraPercent(v)}
              />
            </>
          ) : (
            <>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Extra monthly amount</span>
                <span className="text-primary font-medium">+{formatCurrency(bonusContrib)}/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={extraDollar || ''}
                  onChange={e => setExtraDollar(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">/mo</span>
              </div>
            </>
          )}
          {bonusContrib > 0 && base.months > boosted.months && (
            <p className="text-xs text-gain font-medium">
              ✓ Reach goal {base.months - boosted.months} months sooner!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
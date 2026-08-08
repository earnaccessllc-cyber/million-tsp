import React from 'react';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';
import { resolveContrib } from '@/lib/contributionCalc';
import { Award, CheckCircle, AlertCircle } from 'lucide-react';

function calcScore(profile, funds, totalBalance) {
  const components = [];

  // 1. Contribution rate (25 pts) — getting full 5% match?
  // Read the current contribution settings (percent or dollar mode), not the legacy
  // traditional_contributions/roth_contributions fields, which are no longer populated
  // once a user sets contributions through Settings → Contributions.
  const salary = profile.current_annual_salary || 0;
  const paySchedule = profile.pay_schedule || 'biweekly';
  const trad = resolveContrib(profile.contrib_traditional_mode || 'percent', profile.contrib_traditional_percent || 0, profile.contrib_traditional_dollar || 0, salary, paySchedule);
  const roth = resolveContrib(profile.contrib_roth_mode || 'percent', profile.contrib_roth_percent || 0, profile.contrib_roth_dollar || 0, salary, paySchedule);
  const contribPct = trad.pct + roth.pct;
  const isCSRS = profile.retirement_system === 'CSRS';
  // CSRS gets no agency match at any contribution %, so score on "contributing something"
  // instead of the FERS 5%-for-full-match threshold.
  const contribScore = isCSRS ? Math.min(25, (contribPct / 5) * 25) : Math.min(25, (contribPct / 5) * 25);
  components.push({
    label: 'Contribution Rate',
    score: Math.round(contribScore),
    max: 25,
    tip: isCSRS
      ? (contribPct >= 5 ? '✓ Contributing a healthy amount to TSP.' : 'CSRS gets no agency match, but contributing more still grows your TSP tax-advantaged.')
      : (contribPct < 5 ? 'Contribute at least 5% to get full agency match.' : '✓ Getting full match!'),
    good: contribPct >= 5,
  });

  // 2. Diversification (20 pts) — using multiple fund types?
  const selectedFunds = funds.filter(f => f.is_selected);
  const hasBond = selectedFunds.some(f => ['G Fund', 'F Fund'].includes(f.fund_name));
  const hasEquity = selectedFunds.some(f => ['C Fund', 'S Fund', 'I Fund'].includes(f.fund_name));
  const diversScore = selectedFunds.length >= 3 && hasBond && hasEquity ? 20 : selectedFunds.length >= 2 ? 12 : selectedFunds.length === 1 ? 6 : 0;
  components.push({ label: 'Diversification', score: diversScore, max: 20, tip: diversScore < 20 ? 'Use a mix of stock and bond funds for better diversification.' : '✓ Well diversified!', good: diversScore >= 15 });

  // 3. Goal progress (25 pts)
  const goal = profile.balance_goal || 1_000_000;
  const goalPct = goal > 0 ? Math.min(1, totalBalance / goal) : 0;
  const goalScore = Math.round(goalPct * 25);
  components.push({ label: 'Goal Progress', score: goalScore, max: 25, tip: `${(goalPct * 100).toFixed(1)}% of your ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(goal)} goal reached.`, good: goalPct >= 0.5 });

  // 4. No loan (15 pts) — simplified: always full pts
  components.push({ label: 'Loan Status', score: 15, max: 15, tip: '✓ No active TSP loan detected.', good: true });

  // 5. Beneficiary (15 pts) — placeholder
  components.push({ label: 'Beneficiary Updated', score: 15, max: 15, tip: '✓ Review your beneficiary designation annually.', good: true });

  const total = components.reduce((s, c) => s + c.score, 0);
  return { total, components };
}

export default function FinancialFitnessScore({ profile, funds, totalBalance }) {
  const { isPro } = useProStatus();
  if (!isPro) return <ProGate feature="fitness_score" />;

  const { total, components } = calcScore(profile, funds, totalBalance);
  const grade = total >= 85 ? 'A' : total >= 70 ? 'B' : total >= 55 ? 'C' : 'D';
  const gradeColor = total >= 85 ? 'text-gain' : total >= 70 ? 'text-yellow-400' : 'text-loss';

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Financial Fitness Score</h3>
      </div>

      <div className="flex items-center gap-4 p-3 bg-muted rounded-xl">
        <div className="text-center">
          <p className={`text-5xl font-black ${gradeColor}`}>{grade}</p>
          <p className="text-xs text-muted-foreground">Grade</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold">{total}/100</span>
          </div>
          <div className="bg-background rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${total >= 85 ? 'bg-gain' : total >= 70 ? 'bg-yellow-400' : 'bg-loss'}`}
              style={{ width: `${total}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {components.map((c, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                {c.good
                  ? <CheckCircle className="w-3.5 h-3.5 text-gain" />
                  : <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />}
                <span className="text-xs font-medium">{c.label}</span>
              </div>
              <span className="text-xs font-bold">{c.score}/{c.max}</span>
            </div>
            <div className="bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${c.good ? 'bg-gain' : 'bg-yellow-400'}`}
                style={{ width: `${(c.score / c.max) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
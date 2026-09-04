import React, { useState } from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { projectTSPBalance } from '@/lib/retirementCalc';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Flame, Info } from 'lucide-react';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';

function calcNeeded(annualExpenses, safeWithdrawalRate = 4) {
  return annualExpenses / (safeWithdrawalRate / 100);
}

function calcSEPP(balance, age) {
  // IRS RMD method (simplified)
  const lifeExpectancy = Math.max(1, 90 - age);
  return balance / lifeExpectancy;
}

export default function FIRECalculator({ profile, tspBalance }) {
  const { isPro, loading: planLoading } = useProStatus();
  const [targetAge, setTargetAge] = useState(55);
  const [annualExpenses, setAnnualExpenses] = useState('');
  const [swr, setSwr] = useState(4);

  // Nothing at all until the plan is known — showing the gate first would
  // flash an upsell at a trial or paid user on every mount.
  if (planLoading) return null;
  if (!isPro) return <ProGate feature="fire_calculator" />;

  const currentAge = profile.date_of_birth
    ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
    : null;

  const yearsToTarget = currentAge ? Math.max(0, targetAge - currentAge) : null;
  const expenses = parseFloat(annualExpenses) || 0;
  const neededBalance = calcNeeded(expenses, swr);

  const projectedBalance = yearsToTarget != null
    ? projectTSPBalance(tspBalance, profile, yearsToTarget)
    : null;

  const gap = projectedBalance ? neededBalance - projectedBalance : null;
  const canRetire = gap !== null && gap <= 0;

  const seppAnnual = currentAge ? calcSEPP(tspBalance, currentAge) : null;
  const pensionAge = (() => {
    if (!profile.career_start_date || !profile.date_of_birth) return null;
    const serviceYears = (new Date() - new Date(profile.career_start_date)) / (365.25 * 86400000);
    if (serviceYears >= 20 && currentAge >= 57) return currentAge;
    if (serviceYears >= 30 && currentAge >= 55) return currentAge;
    return 62;
  })();

  const pensionGapYears = pensionAge && targetAge < pensionAge ? pensionAge - targetAge : 0;
  const bridgeNeeded = expenses * pensionGapYears;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold">FIRE Calculator</h3>
        <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-medium">Federal FIRE</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Target Retire Age</Label>
          <Input type="number" value={targetAge} onChange={e => setTargetAge(parseInt(e.target.value) || 55)}
            className="mt-1 h-8 text-sm" min={40} max={70} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Annual Expenses</Label>
          <Input type="number" placeholder="e.g. 60000" value={annualExpenses}
            onChange={e => setAnnualExpenses(e.target.value)} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">SWR %</Label>
          <Input type="number" value={swr} onChange={e => setSwr(parseFloat(e.target.value) || 4)}
            className="mt-1 h-8 text-sm" min={2} max={6} step={0.5} />
        </div>
      </div>

      {expenses > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">FIRE Number needed</p>
              <p className="text-sm font-bold">{formatCurrency(neededBalance)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Projected at age {targetAge}</p>
              <p className={`text-sm font-bold ${canRetire ? 'text-gain' : 'text-loss'}`}>
                {projectedBalance ? formatCurrency(projectedBalance) : '—'}
              </p>
            </div>
          </div>

          {gap !== null && (
            <div className={`rounded-xl p-3 ${canRetire ? 'bg-gain/10 border border-gain/20' : 'bg-loss/10 border border-loss/20'}`}>
              {canRetire ? (
                <p className="text-xs font-semibold text-gain">✓ You could retire at {targetAge} based on these projections!</p>
              ) : (
                <p className="text-xs font-semibold text-loss">Gap: {formatCurrency(gap)} more needed to retire at {targetAge}.</p>
              )}
            </div>
          )}

          {pensionGapYears > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-400 mb-1">Bridge Income Gap</p>
              <p className="text-xs text-muted-foreground">Pension eligibility starts around age {pensionAge}. You need {formatCurrency(bridgeNeeded)} to cover {pensionGapYears} years before pension kicks in.</p>
            </div>
          )}

          {seppAnnual && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-semibold mb-1">SEPP (72t) Distribution</p>
              <p className="text-xs text-muted-foreground">Annual penalty-free withdrawal allowed: <span className="font-semibold text-foreground">{formatCurrency(seppAnnual)}/yr</span></p>
              <p className="text-xs text-muted-foreground mt-1">SEPP lets you withdraw before 59½ without the 10% penalty if you take substantially equal periodic payments for at least 5 years.</p>
            </div>
          )}

          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-semibold mb-1">Rule of 55</p>
            <p className="text-xs text-muted-foreground">Federal employees who separate at age 55+ can withdraw from TSP penalty-free (no 59½ rule applies).</p>
          </div>
        </div>
      )}
    </div>
  );
}
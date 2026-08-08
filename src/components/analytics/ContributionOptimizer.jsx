import React, { useState } from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { Target, AlertTriangle, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { resolveContrib, calcAgencyMatch, PAY_PERIODS, dollarToPct } from '@/lib/contributionCalc';

function calcBalanceAtRetirement(currentBalance, monthlyContrib, annualReturn, years) {
  const monthlyRate = annualReturn / 100 / 12;
  const months = years * 12;
  const future = currentBalance * Math.pow(1 + monthlyRate, months)
    + monthlyContrib * (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
  return Math.round(future);
}

function findRequiredContribPct(currentBalance, salary, annualReturn, years, goalBalance) {
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const monthly = (salary * mid / 100) / 12;
    const projected = calcBalanceAtRetirement(currentBalance, monthly, annualReturn, years);
    if (projected >= goalBalance) hi = mid; else lo = mid;
  }
  return Math.ceil(lo * 10) / 10;
}

export default function ContributionOptimizer({ profile, totalBalance }) {
  const paySchedule = profile.pay_schedule || 'biweekly';
  const periods = PAY_PERIODS[paySchedule] || 26;
  const isCSRS = profile.retirement_system === 'CSRS';
  const effectiveAgencyType = isCSRS ? 'csrs' : (profile.agency_type || 'usps');

  const [salary, setSalary] = useState(profile.current_annual_salary || '');
  const [contribPct, setContribPct] = useState(() => {
    const salary0 = profile.current_annual_salary || 0;
    const trad = resolveContrib(profile.contrib_traditional_mode || 'percent', profile.contrib_traditional_percent || 0, profile.contrib_traditional_dollar || 0, salary0, paySchedule);
    const roth = resolveContrib(profile.contrib_roth_mode || 'percent', profile.contrib_roth_percent || 0, profile.contrib_roth_dollar || 0, salary0, paySchedule);
    return Math.round((trad.pct + roth.pct) * 10) / 10;
  });
  const [extraPct, setExtraPct] = useState(0);
  const [rothPct, setRothPct] = useState(() => {
    const salary0 = profile.current_annual_salary || 0;
    const roth0 = resolveContrib(profile.contrib_roth_mode || 'percent', profile.contrib_roth_percent || 0, profile.contrib_roth_dollar || 0, salary0, paySchedule);
    return Math.round(roth0.pct * 10) / 10;
  });
  const [rothInputMode, setRothInputMode] = useState(profile.contrib_roth_mode || 'percent');
  const [rothDollar, setRothDollar] = useState(() => {
    const salary0 = profile.current_annual_salary || 0;
    const roth0 = resolveContrib(profile.contrib_roth_mode || 'percent', profile.contrib_roth_percent || 0, profile.contrib_roth_dollar || 0, salary0, paySchedule);
    return Math.round(roth0.dollar * 100) / 100;
  });

  const s = parseFloat(salary) || 0;
  const annualReturn = profile.fixed_annual_return || 7;
  const yearsToRetire = profile.date_of_birth
    ? Math.max(1, 62 - (new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()))
    : 20;

  const monthlyContrib = (s * contribPct / 100) / 12;
  const agency = calcAgencyMatch(effectiveAgencyType, contribPct, s, paySchedule);
  const agencyMatch = ((agency.matchDollar || 0) + (agency.auto1Dollar || 0)) * periods / 12;
  const totalMonthly = monthlyContrib + agencyMatch;

  const projectedBase = calcBalanceAtRetirement(totalBalance, totalMonthly, annualReturn, yearsToRetire);
  const projectedExtra = calcBalanceAtRetirement(totalBalance, totalMonthly + (s * extraPct / 100) / 12, annualReturn, yearsToRetire);

  const goal = profile.balance_goal || 1_000_000;
  const requiredPct = s > 0 ? findRequiredContribPct(totalBalance, s, annualReturn, yearsToRetire, goal) : null;

  const notGettingFullMatch = !isCSRS && contribPct < 5;
  const agencyAt5 = calcAgencyMatch(effectiveAgencyType, 5, s, paySchedule);
  const missedMatchMonthly = notGettingFullMatch
    ? (((agencyAt5.matchDollar || 0) + (agencyAt5.auto1Dollar || 0)) - ((agency.matchDollar || 0) + (agency.auto1Dollar || 0))) * periods / 12
    : 0;
  const paycheckImpact = (s * contribPct / 100) / 26; // biweekly
  const extraPaycheckImpact = (s * (contribPct + extraPct) / 100) / 26;

  // Roth % can't exceed the total contribution %; the rest is Traditional.
  // Agency match always lands in Traditional regardless of the employee's Roth/Trad split.
  const rothPctRaw = rothInputMode === 'dollar' ? dollarToPct(rothDollar, s, paySchedule) : rothPct;
  const effectiveRothPct = Math.min(Math.max(rothPctRaw, 0), contribPct);
  const tradPct = Math.max(0, contribPct - effectiveRothPct);
  const rothShareOfBalance = contribPct > 0 ? effectiveRothPct / contribPct : 0;
  const rothMonthly = (s * effectiveRothPct / 100) / 12;
  const tradMonthly = (s * tradPct / 100) / 12 + agencyMatch;
  const projectedRoth = calcBalanceAtRetirement(totalBalance * rothShareOfBalance, rothMonthly, annualReturn, yearsToRetire);
  const projectedTrad = calcBalanceAtRetirement(totalBalance * (1 - rothShareOfBalance), tradMonthly, annualReturn, yearsToRetire);

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Contribution Optimizer</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Annual Salary</Label>
          <Input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="e.g. 75000" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Contribution %</Label>
          <Input type="number" value={contribPct} onChange={e => setContribPct(parseFloat(e.target.value) || 0)} min={0} max={100} className="mt-1 h-8 text-sm" />
        </div>
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs text-muted-foreground">{rothInputMode === 'dollar' ? `Roth $/${paySchedule === 'monthly' ? 'mo' : 'paycheck'}` : `Roth % (of the ${contribPct}% above)`}</Label>
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setRothInputMode('percent')}
                className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${rothInputMode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                style={{ minHeight: 'unset' }}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => setRothInputMode('dollar')}
                className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${rothInputMode === 'dollar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                style={{ minHeight: 'unset' }}
              >
                $
              </button>
            </div>
          </div>
          {rothInputMode === 'dollar' ? (
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input type="number" value={rothDollar} onChange={e => setRothDollar(parseFloat(e.target.value) || 0)} min={0} placeholder="0.00" className="mt-1 h-8 text-sm pl-5" />
            </div>
          ) : (
            <Input type="number" value={rothPct} onChange={e => setRothPct(parseFloat(e.target.value) || 0)} min={0} max={contribPct} className="mt-1 h-8 text-sm" />
          )}
          <p className="text-[11px] text-muted-foreground mt-1">The rest ({tradPct.toFixed(1)}%) goes to Traditional. Agency match is always Traditional.</p>
        </div>
      </div>

      {notGettingFullMatch && s > 0 && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-yellow-400">Missing free money!</p>
            <p className="text-xs text-muted-foreground">Contribute at least 5% to get the full agency match. You're leaving <span className="font-semibold">{formatCurrency(missedMatchMonthly)}/mo</span> on the table.</p>
          </div>
        </div>
      )}

      {s > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Your contribution</p>
              <p className="text-sm font-bold">{formatCurrency(monthlyContrib)}/mo</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Agency match{isCSRS ? ' (CSRS: none)' : ''}</p>
              <p className="text-sm font-bold text-gain">{formatCurrency(agencyMatch)}/mo</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Projected balance</p>
              <p className="text-sm font-bold">{formatCurrency(projectedBase)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Paycheck impact</p>
              <p className="text-sm font-bold text-loss">-{formatCurrency(paycheckImpact)}</p>
            </div>
          </div>

          {requiredPct !== null && (
            <div className={`rounded-xl p-3 ${requiredPct <= contribPct ? 'bg-gain/10 border border-gain/20' : 'bg-primary/10 border border-primary/20'}`}>
              <p className="text-xs font-semibold">
                {requiredPct <= contribPct
                  ? `✓ You're on track to hit ${formatCurrency(goal)}!`
                  : `Need ${requiredPct.toFixed(1)}% to hit goal of ${formatCurrency(goal)}`}
              </p>
              {requiredPct > contribPct && (
                <p className="text-xs text-muted-foreground mt-1">
                  Increase by {(requiredPct - contribPct).toFixed(1)}% = {formatCurrency((requiredPct - contribPct) / 100 * s / 26)} less per paycheck.
                </p>
              )}
            </div>
          )}

          {(effectiveRothPct > 0 || tradPct > 0) && (
            <div className="bg-muted rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold">Traditional vs. Roth split</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Roth ({effectiveRothPct.toFixed(1)}%)</p>
                  <p className="text-sm font-bold">{formatCurrency(rothMonthly)}/mo</p>
                  <p className="text-[11px] text-muted-foreground">Projected: {formatCurrency(projectedRoth)}</p>
                  <p className="text-[11px] text-muted-foreground">Tax-free growth &amp; withdrawals</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Traditional ({tradPct.toFixed(1)}% + match)</p>
                  <p className="text-sm font-bold">{formatCurrency(tradMonthly)}/mo</p>
                  <p className="text-[11px] text-muted-foreground">Projected: {formatCurrency(projectedTrad)}</p>
                  <p className="text-[11px] text-muted-foreground">Pre-tax now, taxed at withdrawal</p>
                </div>
              </div>
            </div>
          )}

          {/* Impact of 1% more */}
          <div className="bg-muted rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-gain" />
              <p className="text-xs font-semibold">Impact of 1% more contribution</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Additional retirement balance: <span className="font-semibold text-gain">{formatCurrency(calcBalanceAtRetirement(0, (s * 1 / 100) / 12, annualReturn, yearsToRetire))}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Paycheck reduction: <span className="font-semibold text-loss">-{formatCurrency(s * 0.01 / 26)}/paycheck</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
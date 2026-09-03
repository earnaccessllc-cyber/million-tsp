import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import DrawerSelect from '@/components/common/DrawerSelect';
import DateDrawer from '@/components/common/DateDrawer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronUp, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  resolveContrib, calcAgencyMatch, pctToDollar, dollarToPct,
  PAY_PERIODS, IRS_LIMIT_2026, calcYTD
} from '@/lib/contributionCalc';
import { localDateString } from '@/lib/balanceUpdatedAt';
import { calcLoanProgress } from '@/lib/loanProgress';

export default function ContributionsSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => {
    if (!activeProfile) return;
    setLocal({
      agency_type: activeProfile.agency_type || 'usps',
      current_annual_salary: activeProfile.current_annual_salary || '',
      pay_schedule: activeProfile.pay_schedule || 'biweekly',
      contrib_traditional_mode: activeProfile.contrib_traditional_mode || 'percent',
      contrib_traditional_percent: activeProfile.contrib_traditional_percent ?? '',
      contrib_traditional_dollar: activeProfile.contrib_traditional_dollar ?? '',
      contrib_roth_mode: activeProfile.contrib_roth_mode || 'percent',
      contrib_roth_percent: activeProfile.contrib_roth_percent ?? '',
      contrib_roth_dollar: activeProfile.contrib_roth_dollar ?? '',
      auto_credit_contributions: activeProfile.auto_credit_contributions === true,
      contribution_posting_lag_days: activeProfile.contribution_posting_lag_days ?? 3,
      pay_date_anchor: activeProfile.pay_date_anchor || '',
    });
    setLoans((activeProfile.loans || []).map(l => ({ ...l })));
  }, [activeProfile?.id]);

  const set = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const [loans, setLoans] = useState([]);
  const updateLoan = (idx, field, value) => {
    setLoans(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };
  const addLoan = () => {
    setLoans(prev => [...prev, {
      id: `loan-${Date.now()}`, label: `Loan ${prev.length + 1}`,
      original_amount: '', start_date: '', per_period_payment: '', repaid: 0,
    }]);
  };
  const removeLoan = (idx) => setLoans(prev => prev.filter((_, i) => i !== idx));

  const salary = parseFloat(local.current_annual_salary) || 0;
  const paySchedule = local.pay_schedule || 'biweekly';
  const periods = PAY_PERIODS[paySchedule] || 26;

  // Echo the next pay day back, so a mistyped anchor is obvious immediately
  // rather than showing up weeks later as a deposit on the wrong day.
  const nextPayDay = (() => {
    if (paySchedule !== 'biweekly' || !local.pay_date_anchor) return null;
    const [y, m, d] = String(local.pay_date_anchor).split('-').map(Number);
    if (!y || !m || !d) return null;
    const anchor = Date.UTC(y, m - 1, d);
    const today = new Date();
    const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const periodsSince = Math.floor((todayUTC - anchor) / (14 * 86400000));
    const next = new Date(anchor + (periodsSince + 1) * 14 * 86400000);
    return next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  })();

  // Coerce blank inputs to 0 for calculations while keeping the fields visually empty
  const tradPct = parseFloat(local.contrib_traditional_percent) || 0;
  const tradDollar = parseFloat(local.contrib_traditional_dollar) || 0;
  const rothPct = parseFloat(local.contrib_roth_percent) || 0;
  const rothDollar = parseFloat(local.contrib_roth_dollar) || 0;

  // Progress is derived from the loan's own start date, per-period payment and
  // the pay calendar, so it reflects the real state of a loan the moment its
  // details are entered — it doesn't have to be accumulated from zero. Read
  // from the draft rather than activeProfile so the bar responds while editing.
  const loanProgress = (idx) => {
    const draft = loans[idx];
    if (!draft) return null;
    return calcLoanProgress(draft, {
      pay_schedule: local.pay_schedule || activeProfile?.pay_schedule,
      pay_date_anchor: local.pay_date_anchor || activeProfile?.pay_date_anchor,
    });
  };

  const trad = resolveContrib(local.contrib_traditional_mode, tradPct, tradDollar, salary, paySchedule);
  const roth = resolveContrib(local.contrib_roth_mode, rothPct, rothDollar, salary, paySchedule);
  const employeePct = trad.pct + roth.pct;
  // retirement_system (Retirement tab) and agency_type here are set independently — a CSRS
  // employee could leave this dropdown at its 'usps' default without ever touching it. CSRS
  // never gets agency match/auto 1%, so it always overrides whatever this field says.
  const isCSRS = activeProfile?.retirement_system === 'CSRS';
  const effectiveAgencyType = isCSRS ? 'csrs' : local.agency_type;
  const agency = calcAgencyMatch(effectiveAgencyType, employeePct, salary, paySchedule);
  const totalPerPeriod = trad.dollar + roth.dollar + agency.matchDollar + (agency.auto1Dollar || 0);
  // Loan repayments go back into the account alongside the contribution, so
  // they are part of what a pay day would add to the balance. Approximate:
  // the nightly job caps each payment at what's actually still owed.
  const loanPerPeriod = loans.reduce((sum, l) => sum + (parseFloat(l.per_period_payment) || 0), 0);
  const lagDays = Math.min(30, Math.max(0, Math.round(parseFloat(local.contribution_posting_lag_days)) || 0));
  const irsWarning = employeePct > 0 && salary > 0 && (trad.dollar + roth.dollar) * periods > IRS_LIMIT_2026;

  const switchMode = (type) => {
    if (type === 'trad') {
      const newMode = local.contrib_traditional_mode === 'percent' ? 'dollar' : 'percent';
      const updates = { contrib_traditional_mode: newMode };
      if (newMode === 'dollar') updates.contrib_traditional_dollar = parseFloat(trad.dollar.toFixed(2));
      else updates.contrib_traditional_percent = parseFloat(trad.pct.toFixed(2));
      setLocal(prev => ({ ...prev, ...updates }));
    } else {
      const newMode = local.contrib_roth_mode === 'percent' ? 'dollar' : 'percent';
      const updates = { contrib_roth_mode: newMode };
      if (newMode === 'dollar') updates.contrib_roth_dollar = parseFloat(roth.dollar.toFixed(2));
      else updates.contrib_roth_percent = parseFloat(roth.pct.toFixed(2));
      setLocal(prev => ({ ...prev, ...updates }));
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    const cleanedLoans = loans
      .filter(l => (parseFloat(l.original_amount) || 0) > 0)
      .map(l => ({
        ...l,
        original_amount: parseFloat(l.original_amount) || 0,
        per_period_payment: parseFloat(l.per_period_payment) || 0,
        repaid: parseFloat(l.repaid) || 0,
      }));
    // contribution_credit_from is where the deposit queue starts paying out.
    // Stamping it on the day crediting is switched on keeps the queue from
    // reaching back into a pay period a reconciled balance already accounts
    // for; it is left alone once set, so toggling off and on again doesn't
    // replay periods that were already credited.
    const enabling = local.auto_credit_contributions === true;
    const creditFrom = enabling
      ? (activeProfile.contribution_credit_from || localDateString())
      : activeProfile.contribution_credit_from;

    await base44.entities.TSPProfile.update(activeProfile.id, {
      ...local,
      contribution_posting_lag_days: lagDays,
      contribution_credit_from: creditFrom,
      current_annual_salary: salary,
      contrib_traditional_percent: tradPct,
      contrib_traditional_dollar: tradDollar,
      contrib_roth_percent: rothPct,
      contrib_roth_dollar: rothDollar,
      loans: cleanedLoans,
    });
    await refreshProfiles();
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const fmt = (n) => n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) ?? '$0.00';
  const fmtPct = (n) => `${parseFloat(n || 0).toFixed(2)}%`;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4"
      >
        <div>
          <p className="text-sm font-semibold text-left">My Contributions</p>
          <p className="text-[10px] text-muted-foreground text-left">Agency match auto-calculated</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

              {/* Agency Type */}
              <div>
                <Label className="text-xs text-muted-foreground">Agency / Employer Type</Label>
                <DrawerSelect
                  value={local.agency_type}
                  onChange={v => set('agency_type', v)}
                  label="Agency / Employer Type"
                  options={[
                    { value: 'usps', label: 'USPS — United States Postal Service' },
                    { value: 'standard_fers', label: 'Standard FERS — Other Federal Agency' },
                    { value: 'csrs', label: 'CSRS — Civil Service Retirement System' },
                  ]}
                />
                {isCSRS && local.agency_type !== 'csrs' && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    Your Retirement System is set to CSRS, so no agency match applies here regardless of this selection.
                  </p>
                )}
              </div>

              {/* Salary */}
              <div>
                <Label className="text-xs text-muted-foreground">Annual Salary</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={local.current_annual_salary}
                    onChange={e => set('current_annual_salary', e.target.value)}
                    className="h-9 text-sm pl-6"
                  />
                </div>
              </div>

              {/* Pay Schedule */}
              <div>
                <Label className="text-xs text-muted-foreground">Pay Schedule</Label>
                <DrawerSelect
                  value={local.pay_schedule}
                  onChange={v => set('pay_schedule', v)}
                  label="Pay Schedule"
                  options={[
                    { value: 'biweekly', label: 'Bi-weekly (26 pay periods/year)' },
                    { value: 'monthly', label: 'Monthly (12 pay periods/year)' },
                  ]}
                />
              </div>

              {/* Which day the fortnight lands on.
                  Without this, biweekly pay periods are counted as 14-day blocks
                  from January 1 — a grid no real pay calendar lines up with, so
                  the app's idea of "pay day" could sit a day or several off the
                  actual one, and both the YTD contribution count and the deposit
                  queue inherited the error. One real pay date pins the whole
                  cycle. */}
              {paySchedule === 'biweekly' && (
                <div>
                  <Label className="text-xs text-muted-foreground">Most Recent Pay Day</Label>
                  <DateDrawer
                    value={local.pay_date_anchor || ''}
                    onChange={v => set('pay_date_anchor', v)}
                    max={new Date().toISOString().split('T')[0]}
                    className={`mt-1 ${local.pay_date_anchor ? '' : 'ring-2 ring-amber-500/60'}`}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {nextPayDay
                      ? `Every 14 days from here — next pay day ${nextPayDay}.`
                      : 'Any recent pay day. Everything else counts forward and back in 14-day steps from it.'}
                  </p>
                </div>
              )}

              {/* Traditional */}
              <ContribField
                label="Traditional TSP Contribution"
                mode={local.contrib_traditional_mode}
                pctValue={local.contrib_traditional_percent}
                dollarValue={local.contrib_traditional_dollar}
                resolved={trad}
                onModeToggle={() => switchMode('trad')}
                onPctChange={v => set('contrib_traditional_percent', v)}
                onDollarChange={v => set('contrib_traditional_dollar', v)}
              />

              {/* Roth */}
              <ContribField
                label="Roth TSP Contribution"
                mode={local.contrib_roth_mode}
                pctValue={local.contrib_roth_percent}
                dollarValue={local.contrib_roth_dollar}
                resolved={roth}
                onModeToggle={() => switchMode('roth')}
                onPctChange={v => set('contrib_roth_percent', v)}
                onDollarChange={v => set('contrib_roth_dollar', v)}
              />

              {irsWarning && (
                <p className="text-xs text-loss bg-loss/10 rounded-lg p-2">
                  ⚠️ Combined Traditional + Roth exceeds the 2026 IRS limit of {fmt(IRS_LIMIT_2026)}/year.
                </p>
              )}

              {/* Loans — a profile can have more than one active TSP loan */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">TSP Loans</p>
                  <button
                    type="button"
                    onClick={addLoan}
                    className="text-xs font-semibold text-primary"
                    style={{ minHeight: 'unset' }}
                  >
                    + Add loan
                  </button>
                </div>

                {loans.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">No active loans on file.</p>
                )}

                {loans.map((loan, idx) => {
                  const progress = loanProgress(idx);
                  return (
                    <div key={loan.id || idx} className="rounded-lg bg-secondary/30 border border-border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          value={loan.label || ''}
                          onChange={e => updateLoan(idx, 'label', e.target.value)}
                          placeholder={`Loan ${idx + 1}`}
                          className="h-7 text-xs font-semibold w-32 bg-transparent border-none px-0"
                        />
                        <button
                          type="button"
                          onClick={() => removeLoan(idx)}
                          className="text-[10px] text-loss"
                          style={{ minHeight: 'unset' }}
                        >
                          Remove
                        </button>
                      </div>
                      {/* min-w-0: grid items default to min-width:auto and won't shrink
                          below their content, which is how the fields below used to spill
                          out of their columns on a phone. */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <Label className="text-xs text-muted-foreground">Original amount</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input
                              type="number"
                              placeholder="0"
                              value={loan.original_amount}
                              onChange={e => updateLoan(idx, 'original_amount', e.target.value)}
                              className="h-9 text-sm pl-6 w-full min-w-0"
                            />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <Label className="text-xs text-muted-foreground">Per pay period</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                            <Input
                              type="number"
                              placeholder="0"
                              value={loan.per_period_payment}
                              onChange={e => updateLoan(idx, 'per_period_payment', e.target.value)}
                              className="h-9 text-sm pl-6 w-full min-w-0"
                            />
                          </div>
                        </div>
                      </div>
                      {/* Date and money fields don't share a row.
                          A native date input reports a wide intrinsic size on mobile and
                          renders its own formatted text, so at half a phone's width it
                          crowded the field beside it — and because a grid item won't
                          shrink below its content (min-width:auto), it overflowed its
                          column and sat underneath. Two full-width rows are simply the
                          right shape for these two: the date needs the room, and the
                          paid-off figure has a line of explanation under it. */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Loan Start Date</Label>
                        <Input
                          type="date"
                          value={loan.start_date || ''}
                          onChange={e => updateLoan(idx, 'start_date', e.target.value)}
                          className="h-9 text-sm mt-1 w-full min-w-0 block text-left"
                        />
                      </div>

                      {/* Paid off so far fills itself in from the start date and the
                          per-period payment — that is the normal case, and it is shown as
                          a real value rather than a placeholder so the number is visible
                          without anyone having to work it out. Typing replaces it with an
                          override, for what the calculation can't know (extra payments, a
                          payroll gap); clearing the box hands it back to the calculation. */}
                      <div>
                        <div className="flex items-baseline justify-between gap-2">
                          <Label className="text-xs text-muted-foreground">Paid off so far</Label>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {progress?.isOverridden
                              ? 'Manual — clear to recalculate'
                              : `Auto from ${progress?.periodsElapsed ?? 0} payments`}
                          </span>
                        </div>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            placeholder="0"
                            value={
                              progress?.isOverridden
                                ? loan.repaid
                                : (progress ? progress.derived.toFixed(2) : '')
                            }
                            onChange={e => updateLoan(idx, 'repaid', e.target.value)}
                            className={`h-9 text-sm pl-6 w-full min-w-0 ${progress?.isOverridden ? '' : 'text-muted-foreground'}`}
                          />
                        </div>
                      </div>

                      {progress && progress.isOverridden && progress.repaid > (parseFloat(loan.original_amount) || 0) && (
                        <p className="text-[10px] text-loss">
                          Paid off is more than the original amount — the loan counts as settled and no further
                          repayments will be added.
                        </p>
                      )}

                      {/* Paydown progress, worked out from the fields above rather than
                          read from a stored counter — so it responds while editing and is
                          right from the moment a loan is entered. */}
                      {progress && (
                        <div className="rounded-lg bg-muted/60 border border-border p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-foreground">
                              {progress.isPaidOff ? 'Paid off' : 'Progress'}
                            </span>
                            <span className="text-[11px] font-bold text-primary">{progress.pct.toFixed(1)}% paid off</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progress.isPaidOff ? 'bg-gain' : 'bg-primary'}`}
                              style={{ width: `${progress.pct}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Remaining</p>
                              <p className="text-xs font-bold">{fmt(progress.remaining)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Repaid so far</p>
                              <p className="text-xs font-bold text-gain">{fmt(progress.repaid)}</p>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground pt-0.5">
                            {progress.isPaidOff
                              ? 'No further repayments will be added to your balance.'
                              : `${progress.periodsElapsed} payments made${
                                  progress.periodsRemaining ? `, ${progress.periodsRemaining} to go` : ''
                                }${
                                  progress.payoffDate
                                    ? ` — paid off around ${progress.payoffDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                                    : ''
                                }.`}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Agency match status box */}
              {effectiveAgencyType !== 'csrs' && salary > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Agency Match Status</p>
                    {(() => {
                      const atMax = employeePct >= 5;
                      return (
                        <span className={`text-[10px] font-semibold ${atMax ? 'text-gain' : 'text-muted-foreground'}`}>
                          {atMax ? '✓ Max match reached' : `Contribute ${(5 - employeePct).toFixed(1)}% more for full match`}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(employeePct / 5 * 100, 100)}%`,
                        background: employeePct >= 5 ? '#4ade80' : 'hsl(var(--primary))'
                      }}
                    />
                  </div>
                  {effectiveAgencyType === 'standard_fers' && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Auto 1%</span>
                      <span className="font-semibold">{fmt(agency.auto1Dollar)}/period</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{effectiveAgencyType === 'usps' ? 'Agency match (incl. auto)' : 'Agency match'}</span>
                    <span className="font-semibold text-gain">{fmt(agency.matchDollar)}/period</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-primary/20 pt-1.5">
                    <span className="text-muted-foreground">Total agency</span>
                    <span className="font-bold text-primary">{fmt(agency.matchDollar + (agency.auto1Dollar || 0))}/period</span>
                  </div>
                </div>
              )}

              {/* Auto-calculated summary */}
              <div className="bg-secondary/40 rounded-xl p-3 space-y-2 text-xs font-mono">
                <SummaryRow label="Your contribution" value={`${fmtPct(employeePct)} = ${fmt(trad.dollar + roth.dollar)}/period`} />
                {effectiveAgencyType !== 'csrs' && (
                  <>
                    {effectiveAgencyType === 'standard_fers' && (
                      <SummaryRow label="Auto 1% (always)" value={`${fmt(agency.auto1Dollar)}/period`} color="text-gain" badge="AUTO" />
                    )}
                    <SummaryRow
                      label={effectiveAgencyType === 'usps' ? 'Agency match (incl. auto)' : 'Agency match'}
                      value={`${fmtPct(agency.matchPct)} = ${fmt(agency.matchDollar)}/period`}
                      color="text-gain"
                      badge="AUTO"
                    />
                  </>
                )}
                <div className="border-t border-border/50 pt-2">
                  <SummaryRow label="Total per period" value={fmt(totalPerPeriod)} bold />
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Agency match updates automatically when you change your contribution %.
                </p>
              </div>

              {/* When the pay-period deposit reaches the balance.
                  Payroll takes it on the pay date; TSP posts it a few business
                  days later and buys units at that day's price. Crediting it on
                  the pay date made the balance run ahead of tsp.gov until TSP
                  caught up, so the lag is modelled explicitly rather than
                  assumed away — and it is a real per-agency number, which is why
                  it is editable rather than hardcoded. */}
              <div className="bg-secondary/30 rounded-xl p-3 border border-border/50 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Track contributions automatically</p>
                    <p className="text-xs text-muted-foreground">
                      Add each pay period's deposit when TSP posts it
                    </p>
                  </div>
                  <Switch
                    checked={local.auto_credit_contributions === true}
                    onCheckedChange={(v) => set('auto_credit_contributions', v)}
                  />
                </div>

                {local.auto_credit_contributions && (
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/50">
                    <div>
                      <Label htmlFor="posting-lag" className="text-xs">Posting delay</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Business days from pay day to when it lands
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Input
                        id="posting-lag"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="30"
                        className="w-16 h-8 text-center"
                        value={local.contribution_posting_lag_days ?? 3}
                        onChange={(e) => set('contribution_posting_lag_days', e.target.value)}
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {local.auto_credit_contributions
                    ? `About ${fmt(totalPerPeriod + loanPerPeriod)} comes out of each check. It lands in your balance ${lagDays === 0 ? 'on the pay date itself' : `${lagDays} business day${lagDays === 1 ? '' : 's'} later`}, bought at that day's share price — the same way TSP does it. Check your TSP transaction history: if the deposit shows up on a different day than this expects, change the number above and it will match from then on.`
                    : 'Off: your balance moves only when fund prices move, and deposits appear when you reconcile against tsp.gov. Loan payoff progress is tracked either way.'}
                </p>
              </div>

              <Button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                size="sm"
                className={`w-full gap-2 ${saveStatus === 'saved' ? 'bg-gain/20 text-gain border border-gain/30 hover:bg-gain/20' : ''}`}
                variant={saveStatus === 'saved' ? 'outline' : 'default'}
              >
                {saveStatus === 'saving' && <><Save className="w-3.5 h-3.5 animate-pulse" /> Saving…</>}
                {saveStatus === 'saved' && <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>}
                {saveStatus === 'idle' && <><Save className="w-3.5 h-3.5" /> Save Contributions</>}
              </Button>

              {/* YTD Activity */}
              {(() => {
                const ytd = calcYTD({ ...activeProfile, ...local, current_annual_salary: salary, contrib_traditional_percent: tradPct, contrib_traditional_dollar: tradDollar, contrib_roth_percent: rothPct, contrib_roth_dollar: rothDollar, loans });
                if (!ytd.periodsElapsed || !salary) return null;
                const isCSRSForYTD = effectiveAgencyType === 'csrs';
                const isStandardFERS = effectiveAgencyType === 'standard_fers';
                return (
                  <div className="bg-secondary/30 rounded-xl p-3 space-y-2 border border-border/50">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      YTD Activity · {ytd.periodsElapsed} of {ytd.periodsTotal} pay periods
                    </p>
                    <YTDRow label="Traditional" value={ytd.tradYTD} />
                    {ytd.rothYTD > 0 && <YTDRow label="Roth" value={ytd.rothYTD} />}
                    {!isCSRSForYTD && (
                      <>
                        {isStandardFERS && ytd.auto1YTD > 0 && (
                          <YTDRow label="Auto 1%" value={ytd.auto1YTD} color="text-gain" badge="AUTO" />
                        )}
                        <YTDRow
                          label={effectiveAgencyType === 'usps' ? 'Agency match (incl. auto)' : 'Agency match'}
                          value={ytd.matchYTD}
                          color="text-gain"
                          badge="AUTO"
                        />
                      </>
                    )}
                    {ytd.loanYTD > 0 && <YTDRow label="Loan Repayments" value={ytd.loanYTD} />}
                    <div className="border-t border-border/50 pt-2">
                      <YTDRow
                        label="Total employee contributions"
                        value={ytd.tradYTD + ytd.rothYTD}
                        bold
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContribField({ label, mode, pctValue, dollarValue, resolved, onModeToggle, onPctChange, onDollarChange }) {
  const fmt = (n) => n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }) ?? '$0.00';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <button
          onClick={onModeToggle}
          className="text-[10px] text-primary border border-primary/30 rounded px-2 py-0.5 flex items-center gap-1"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          Switch to {mode === 'percent' ? '$' : '%'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {mode === 'percent' ? (
          <div className="relative flex-1">
            <Input
              type="number"
              step="0.5"
              min="0"
              max="100"
              value={pctValue}
              onChange={e => onPctChange(e.target.value)}
              className="h-9 text-sm pr-6"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        ) : (
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              step="1"
              min="0"
              value={dollarValue}
              onChange={e => onDollarChange(e.target.value)}
              className="h-9 text-sm pl-6"
            />
          </div>
        )}
      </div>
      {(resolved.pct > 0 || resolved.dollar > 0) && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {mode === 'percent'
            ? `${resolved.pct.toFixed(2)}% = ${fmt(resolved.dollar)}/period`
            : `${fmt(resolved.dollar)}/period = ${resolved.pct.toFixed(2)}% of salary`}
        </p>
      )}
    </div>
  );
}

function YTDRow({ label, value, color = 'text-foreground', badge, bold }) {
  const fmt = (n) => n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) ?? '$0';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${color} ${bold ? 'font-bold' : 'font-medium'} flex items-center gap-1`}>
        {fmt(value)}
        {badge && <span className="text-[9px] bg-gain/20 text-gain px-1 rounded">{badge}</span>}
      </span>
    </div>
  );
}

function SummaryRow({ label, value, color = 'text-foreground', badge, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${color} ${bold ? 'font-bold' : ''} flex items-center gap-1`}>
        {value}
        {badge && <span className="text-[9px] bg-gain/20 text-gain px-1 rounded">{badge}</span>}
      </span>
    </div>
  );
}
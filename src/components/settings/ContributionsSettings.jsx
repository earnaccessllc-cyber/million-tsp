import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import DrawerSelect from '@/components/common/DrawerSelect';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  resolveContrib, calcAgencyMatch, pctToDollar, dollarToPct,
  PAY_PERIODS, IRS_LIMIT_2026, calcYTD
} from '@/lib/contributionCalc';

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
      contrib_loan_per_period: activeProfile.contrib_loan_per_period ?? '',
      loan_end_date: activeProfile.loan_end_date || '',
      loan_original_amount: activeProfile.loan_original_amount ?? '',
      loan_start_date: activeProfile.loan_start_date || '',
    });
  }, [activeProfile?.id]);

  const set = (field, value) => setLocal(prev => ({ ...prev, [field]: value }));

  const salary = parseFloat(local.current_annual_salary) || 0;
  const paySchedule = local.pay_schedule || 'biweekly';
  const periods = PAY_PERIODS[paySchedule] || 26;

  // Coerce blank inputs to 0 for calculations while keeping the fields visually empty
  const tradPct = parseFloat(local.contrib_traditional_percent) || 0;
  const tradDollar = parseFloat(local.contrib_traditional_dollar) || 0;
  const rothPct = parseFloat(local.contrib_roth_percent) || 0;
  const rothDollar = parseFloat(local.contrib_roth_dollar) || 0;
  const loanPerPeriod = parseFloat(local.contrib_loan_per_period) || 0;
  const loanOriginalAmount = parseFloat(local.loan_original_amount) || 0;
  const loanRepaid = activeProfile?.loan_repayments || 0;
  const loanRemaining = Math.max(0, (activeProfile?.loan_original_amount || 0) - loanRepaid);
  const loanPctPaid = activeProfile?.loan_original_amount > 0
    ? Math.min(100, (loanRepaid / activeProfile.loan_original_amount) * 100)
    : 0;

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
    await base44.entities.TSPProfile.update(activeProfile.id, {
      ...local,
      current_annual_salary: salary,
      contrib_traditional_percent: tradPct,
      contrib_traditional_dollar: tradDollar,
      contrib_roth_percent: rothPct,
      contrib_roth_dollar: rothDollar,
      contrib_loan_per_period: loanPerPeriod,
      loan_original_amount: loanOriginalAmount,
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

              {/* Loan Repayment + End Date */}
              <div className="rounded-lg border border-border p-3 space-y-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Loan Repayment</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Amount per pay period</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={local.contrib_loan_per_period}
                        onChange={e => set('contrib_loan_per_period', e.target.value)}
                        className="h-9 text-sm pl-6"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Original loan amount</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        placeholder="0"
                        value={local.loan_original_amount}
                        onChange={e => set('loan_original_amount', e.target.value)}
                        className="h-9 text-sm pl-6"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1">Leave both at $0 if you have no active loan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Loan Start Date</Label>
                    <Input
                      type="date"
                      value={local.loan_start_date || ''}
                      onChange={e => set('loan_start_date', e.target.value)}
                      className="h-9 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Loan Payment End Date</Label>
                    <Input
                      type="date"
                      value={local.loan_end_date || ''}
                      onChange={e => set('loan_end_date', e.target.value)}
                      className="h-9 text-sm mt-1"
                    />
                  </div>
                </div>
                {local.loan_end_date && (
                  <p className="text-[10px] text-muted-foreground">
                    Payoff date: {new Date(local.loan_end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}

                {/* Live paydown progress — reflects actual repayments tracked by the
                    nightly job, not the unsaved fields above */}
                {activeProfile?.loan_original_amount > 0 && (
                  <div className="rounded-lg bg-secondary/40 border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Loan Progress</span>
                      <span className="text-xs font-bold text-primary">{loanPctPaid.toFixed(1)}% paid off</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${loanPctPaid}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Remaining balance</p>
                        <p className="text-sm font-bold">{fmt(loanRemaining)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Repaid so far</p>
                        <p className="text-sm font-bold text-gain">{fmt(loanRepaid)}</p>
                      </div>
                    </div>
                  </div>
                )}
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
                const ytd = calcYTD({ ...activeProfile, ...local, current_annual_salary: salary, contrib_traditional_percent: tradPct, contrib_traditional_dollar: tradDollar, contrib_roth_percent: rothPct, contrib_roth_dollar: rothDollar, contrib_loan_per_period: loanPerPeriod });
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
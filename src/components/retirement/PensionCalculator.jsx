import React from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { calcRetirement } from '@/lib/retirementCalc';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

function fmt(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PensionCalculator({ profile, tspBalance }) {
  const result = calcRetirement(profile, tspBalance);

  if (!result) {
    return (
      <div className="p-4 bg-card rounded-xl border border-border text-center">
        <Info className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Enter your date of birth and career start date above to see retirement estimates.
        </p>
      </div>
    );
  }

  const {
    ageAtRetirement, yearsOfService, totalCreditableService, high3, annualPension, monthlyPension,
    pensionFormula, srsEligible, srsAmount, srsReason, srsEndDate, ssBenefitAt62,
    tspMonthly, retirementDate, isPlannedSet, mra,
    projectedTSPBalance, yearsToRetirement,
    sickLeaveHours, sickLeaveCredit,
  } = result;

  const hasSickLeave = sickLeaveHours > 0;

  return (
    <div className="space-y-4">
      {/* Service Summary */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Service at {isPlannedSet ? 'Planned Retirement' : 'Today'}
        </h3>
        {isPlannedSet && (
          <p className="text-[10px] text-muted-foreground mb-3">Retiring {fmt(retirementDate)}</p>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-lg font-bold">{ageAtRetirement.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Age</p>
          </div>
          <div>
            <p className="text-lg font-bold">{yearsOfService.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground">Years Service</p>
          </div>
          <div>
            <p className="text-lg font-bold">{formatCurrency(high3)}</p>
            <p className="text-[10px] text-muted-foreground">High-3 Avg</p>
          </div>
        </div>
      </div>

      {/* Pension */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {profile.retirement_system} Pension
        </h3>
        <p className="text-xs text-muted-foreground mb-1">{pensionFormula}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-primary">{formatCurrency(monthlyPension)}</p>
          <span className="text-xs text-muted-foreground">/month</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{formatCurrency(annualPension)} annually</p>
        {hasSickLeave && (
          <p className="text-[10px] text-primary/70 mt-2 border-t border-border pt-2">
            Includes {sickLeaveCredit.months > 0 || sickLeaveCredit.years > 0
              ? `${sickLeaveCredit.years > 0 ? sickLeaveCredit.years + ' yr ' : ''}${sickLeaveCredit.months} mo ${sickLeaveCredit.days} day sick leave credit`
              : `${sickLeaveCredit.days} day sick leave credit`} ({sickLeaveHours.toLocaleString()} hrs)
          </p>
        )}
      </div>

      {/* SRS (FERS only) */}
      {profile.retirement_system === 'FERS' && (
        <div className="p-4 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Special Retirement Supplement
            </h3>
            {srsEligible ? (
              <Badge className="bg-gain/10 text-gain border-gain/20 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Eligible
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-loss/30 text-loss">
                <XCircle className="w-3 h-3 mr-1" /> Not Eligible
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">{srsReason}</p>
          {srsEligible && (
            <>
              <p className="text-xs text-muted-foreground mb-1">
                ({yearsOfService.toFixed(1)} yrs ÷ 40) × {formatCurrency(ssBenefitAt62)} <span className="opacity-70">(SS benefit at 62, not FRA)</span>
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-bold">{formatCurrency(srsAmount)}</p>
                <span className="text-xs text-muted-foreground">/month</span>
              </div>
              {srsEndDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  Paid from {fmt(retirementDate)} → {fmt(srsEndDate)} (until age 62)
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* TSP Withdrawal */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          TSP Withdrawal Estimate
        </h3>
        {yearsToRetirement > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground">Est. TSP balance at retirement</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(projectedTSPBalance)}</p>
            <p className="text-[10px] text-muted-foreground">
              Projected {yearsToRetirement.toFixed(1)} yrs at {profile.fixed_annual_return || 7}% + contributions
            </p>
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold">{formatCurrency(tspMonthly)}</p>
          <span className="text-xs text-muted-foreground">/month</span>
        </div>
      </div>
    </div>
  );
}
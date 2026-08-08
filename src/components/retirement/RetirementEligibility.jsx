import React from 'react';
import { calcRetirement } from '@/lib/retirementCalc';
import { CheckCircle2, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function fmt(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(date) {
  if (!date) return null;
  return Math.floor((date - new Date()) / 86400000);
}

export default function RetirementEligibility({ profile }) {
  const result = calcRetirement(profile, 0);
  if (!result) return null;

  const { earliest, retirementDate, ageAtRetirement, yearsOfService, isPlannedSet, dob, birthYear } = result;
  const earliestDate = earliest?.earliest?.date;
  const earliestRule = earliest?.earliest?.rule;

  const daysToPlanned = isPlannedSet ? daysUntil(retirementDate) : null;
  const daysToEarliest = daysUntil(earliestDate);

  const isEligible = !isPlannedSet || (earliestDate && retirementDate >= earliestDate);
  const isEarliestInPast = earliestDate && earliestDate <= new Date();

  return (
    <div className="space-y-3">
      {/* Earliest Possible */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Earliest Eligible Retirement
        </h3>
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">{fmt(earliestDate)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{earliestRule}</p>
            {isEarliestInPast ? (
              <Badge className="mt-2 text-[10px] bg-gain/10 text-gain border-gain/20">✅ Already eligible</Badge>
            ) : daysToEarliest != null ? (
              <p className="text-xs text-muted-foreground mt-1">{daysToEarliest.toLocaleString()} days away</p>
            ) : null}
          </div>
        </div>

        {/* All options */}
        {earliest?.all && earliest.all.length > 1 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">All Options</p>
            {earliest.all.map((opt, i) => (
              <div key={i} className={`flex items-center justify-between text-xs p-1.5 rounded ${opt.date === earliestDate ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'}`}>
                <span className="flex-1 mr-2">{opt.rule}</span>
                <span className="font-medium whitespace-nowrap">{fmt(opt.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planned Retirement */}
      {isPlannedSet && (
        <div className={`p-4 rounded-xl border ${isEligible ? 'bg-gain/5 border-gain/20' : 'bg-loss/5 border-loss/20'}`}>
          <div className="flex items-start gap-2">
            {isEligible
              ? <CheckCircle2 className="w-4 h-4 text-gain mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-loss mt-0.5 flex-shrink-0" />
            }
            <div>
              <p className="text-sm font-bold">{fmt(retirementDate)}</p>
              <p className="text-xs mt-0.5">
                Age {ageAtRetirement.toFixed(1)} · {yearsOfService.toFixed(1)} years service
              </p>
              <p className={`text-xs mt-1 font-medium ${isEligible ? 'text-gain' : 'text-loss'}`}>
                {isEligible
                  ? '✅ You are eligible to retire on this date'
                  : '⚠️ You may not be eligible to retire on this date'}
              </p>
              {daysToPlanned != null && daysToPlanned > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{daysToPlanned.toLocaleString()} days away</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
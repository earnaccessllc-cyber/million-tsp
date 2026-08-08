import React from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSickLeaveCredit, calcRetirement } from '@/lib/retirementCalc';
import { formatCurrency } from '@/lib/tspFunds';
import { useNavigate } from 'react-router-dom';

function formatCredit(credit) {
  const parts = [];
  if (credit.years > 0) parts.push(`${credit.years}yr`);
  if (credit.months > 0) parts.push(`${credit.months}mo`);
  if (credit.days > 0) parts.push(`${credit.days}d`);
  return parts.join(' ') || '0d';
}

export default function SickLeaveCard({ profile, tspBalance }) {
  const navigate = useNavigate();

  const currentHours = profile?.sick_leave_current_hours || 0;
  const estimatedHours = profile?.sick_leave_estimated_hours || 0;

  if (!currentHours && !estimatedHours) return null;

  const currentCredit = getSickLeaveCredit(currentHours);
  const estimatedCredit = getSickLeaveCredit(estimatedHours || currentHours);

  // Calculate pension value boost from sick leave
  const resultWithSickLeave = calcRetirement(profile, tspBalance);
  const resultWithout = calcRetirement({ ...profile, sick_leave_estimated_hours: 0, sick_leave_current_hours: 0 }, tspBalance);
  const pensionBoost = resultWithSickLeave && resultWithout
    ? resultWithSickLeave.monthlyPension - resultWithout.monthlyPension
    : 0;

  return (
    <div className="mx-4 mt-4 p-4 bg-card rounded-xl border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Sick Leave Credit</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-[10px] text-primary h-6 px-2"
          onClick={() => navigate('/retirement')}
        >
          Update
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground">Current Balance</p>
          <p className="text-base font-bold">{currentHours.toLocaleString()} hrs</p>
          <p className="text-[10px] text-muted-foreground">{formatCredit(currentCredit)} credit</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Est. at Retirement</p>
          <p className="text-base font-bold">{(estimatedHours || currentHours).toLocaleString()} hrs</p>
          <p className="text-[10px] text-muted-foreground">{formatCredit(estimatedCredit)} credit</p>
        </div>
      </div>

      {pensionBoost > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground">Additional pension from sick leave</p>
          <p className="text-sm font-bold text-gain">+{formatCurrency(pensionBoost)}/mo</p>
        </div>
      )}
    </div>
  );
}
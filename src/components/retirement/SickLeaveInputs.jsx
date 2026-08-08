import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Info } from 'lucide-react';

const HOURS_PER_YEAR = 2087;
const HOURS_PER_MONTH = 174;

export function convertSickLeaveToService(hours) {
  if (!hours || hours <= 0) return { years: 0, months: 0, days: 0, decimal: 0 };
  const totalYears = hours / HOURS_PER_YEAR;
  const years = Math.floor(totalYears);
  const remainingAfterYears = hours - years * HOURS_PER_YEAR;
  const months = Math.floor(remainingAfterYears / HOURS_PER_MONTH);
  const remainingAfterMonths = remainingAfterYears - months * HOURS_PER_MONTH;
  const days = Math.floor(remainingAfterMonths / (HOURS_PER_MONTH / 30));
  return { years, months, days, decimal: totalYears };
}

export default function SickLeaveInputs({ profile, onUpdate }) {
  const currentHours = profile?.sick_leave_current_hours || 0;
  const estimatedHours = profile?.sick_leave_estimated_hours || 0;

  // Calculate years until retirement for auto-suggestion
  const autoSuggestedHours = useMemo(() => {
    if (!profile?.planned_retirement_date || !currentHours) return null;
    const retDate = new Date(profile.planned_retirement_date);
    const now = new Date();
    const yearsUntil = Math.max(0, (retDate - now) / (1000 * 60 * 60 * 24 * 365.25));
    return Math.round(currentHours + yearsUntil * 104);
  }, [profile?.planned_retirement_date, currentHours]);

  const displayHours = autoSuggestedHours || currentHours || 0;
  const converted = convertSickLeaveToService(displayHours);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sick Leave</h4>
      </div>

      {/* Current Sick Leave */}
      <div>
        <Label className="text-xs text-muted-foreground">Current Sick Leave Balance (hours)</Label>
        <Input
          type="number"
          placeholder="800"
          value={currentHours || ''}
          onChange={e => onUpdate({ sick_leave_current_hours: parseFloat(e.target.value) || 0 })}
          className="h-9 text-sm mt-1"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Check your leave and earnings statement for your current sick leave balance
        </p>
      </div>



      {/* Conversion display */}
      {displayHours > 0 && (
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-1.5">
          <p className="text-[11px] font-semibold text-foreground">
            Your estimated sick leave at retirement: {displayHours.toLocaleString()} hours
          </p>
          <p className="text-[11px] text-primary font-medium">
            Converts to: {converted.years > 0 ? `${converted.years} year${converted.years !== 1 ? 's' : ''}, ` : ''}
            {converted.months} month{converted.months !== 1 ? 's' : ''}, {converted.days} day{converted.days !== 1 ? 's' : ''} of additional service
          </p>
          <p className="text-[10px] text-muted-foreground">
            Based on OPM: 2,087 hours = 1 full year of service
          </p>
          <div className="flex items-start gap-1.5 mt-2 pt-2 border-t border-primary/10">
            <Info className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              Sick leave counts toward pension <span className="font-semibold text-foreground">calculation only</span> — not toward retirement eligibility (MRA, 30 yrs, 20 yrs, etc.)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
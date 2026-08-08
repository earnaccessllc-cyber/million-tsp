import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Calendar } from 'lucide-react';
import { calcEarliestFERSRetirement, calcEarliestCSRSRetirement } from '@/lib/retirementCalc';
import { getMRA } from '@/lib/tspFunds';

function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(null);
  useEffect(() => {
    if (!targetDate) return;
    const calc = () => {
      const now = new Date();
      const diff = targetDate - now;
      if (diff <= 0) return setTimeLeft({ done: true });
      const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
      const months = Math.floor((diff % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000));
      const days = Math.floor((diff % (30.44 * 24 * 3600 * 1000)) / (24 * 3600 * 1000));
      const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
      setTimeLeft({ years, months, days, hours, totalDays: Math.floor(diff / 86400000) });
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);
  return timeLeft;
}

function fmt(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtShort(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function CountdownGrid({ timeLeft }) {
  if (!timeLeft) return <div className="h-16 flex items-center justify-center"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (timeLeft.done) return <p className="text-gain font-bold text-center">🎉 Date reached!</p>;
  return (
    <div className="grid grid-cols-4 gap-2">
      {[{ value: timeLeft.years, label: 'Years' }, { value: timeLeft.months, label: 'Months' }, { value: timeLeft.days, label: 'Days' }, { value: timeLeft.hours, label: 'Hours' }].map(({ value, label }) => (
        <div key={label} className="bg-muted rounded-xl p-2 text-center">
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
        </div>
      ))}
    </div>
  );
}

const MILESTONES = [
  { label: '10 Years', days: 3650, emoji: '🔟' },
  { label: '5 Years', days: 1825, emoji: '🖐️' },
  { label: '1 Year', days: 365, emoji: '📅' },
  { label: '6 Months', days: 180, emoji: '⏳' },
  { label: '100 Days', days: 100, emoji: '💯' },
  { label: '30 Days', days: 30, emoji: '🚀' },
];

export default function RetirementCountdown({ profile, compact }) {
  const dob = useMemo(() => profile?.date_of_birth ? new Date(profile.date_of_birth) : null, [profile?.date_of_birth]);
  const careerStart = useMemo(() => profile?.career_start_date ? new Date(profile.career_start_date) : null, [profile?.career_start_date]);
  const birthYear = dob?.getFullYear();

  // Planned retirement date
  const plannedDate = useMemo(() => profile?.planned_retirement_date ? new Date(profile.planned_retirement_date) : null, [profile?.planned_retirement_date]);

  // Earliest retirement date
  const { earliestDate, earliestRule } = useMemo(() => {
    if (!dob || !careerStart) return { earliestDate: null, earliestRule: '' };
    const earliest = profile?.retirement_system === 'CSRS'
      ? calcEarliestCSRSRetirement(dob, careerStart)
      : calcEarliestFERSRetirement(dob, careerStart);
    return { earliestDate: earliest?.earliest?.date || null, earliestRule: earliest?.earliest?.rule || '' };
  }, [dob, careerStart, profile?.retirement_system]);

  // Primary countdown target: planned date if set, otherwise MRA date
  const { primaryDate, primaryLabel } = useMemo(() => {
    if (plannedDate) return { primaryDate: plannedDate, primaryLabel: 'Planned Retirement' };
    if (dob && birthYear) {
      const mra = getMRA(birthYear);
      const mraDate = new Date(dob);
      mraDate.setFullYear(mraDate.getFullYear() + Math.floor(mra));
      return { primaryDate: mraDate, primaryLabel: 'MRA Date' };
    }
    return { primaryDate: null, primaryLabel: 'Planned Retirement' };
  }, [plannedDate, dob, birthYear]);

  const primaryCountdown = useCountdown(primaryDate);
  const earliestCountdown = useCountdown(earliestDate);

  if (!dob) {
    if (compact) return null;
    return (
      <div className="bg-card rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
        Add your date of birth in Your Information to see the countdown.
      </div>
    );
  }

  // Compact for Dashboard
  if (compact && primaryCountdown && !primaryCountdown.done) {
    return (
      <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
        <Clock className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{primaryLabel}</p>
          <p className="text-sm font-bold">
            {primaryCountdown.years}y {primaryCountdown.months}m {primaryCountdown.days}d
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{fmtShort(primaryDate)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Primary Countdown */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{primaryLabel}</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center mb-4">{fmt(primaryDate)}</p>
        <CountdownGrid timeLeft={primaryCountdown} />
        {primaryCountdown && !primaryCountdown.done && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            {primaryCountdown.totalDays.toLocaleString()} total days remaining
          </p>
        )}
      </div>

      {/* Earliest Eligible — only show if different from planned */}
      {earliestDate && (!plannedDate || earliestDate.toDateString() !== plannedDate.toDateString()) && (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-chart-3" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Earliest Eligible</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{earliestRule}</p>
          <p className="text-sm font-bold mb-3">{fmt(earliestDate)}</p>
          {earliestCountdown && !earliestCountdown.done ? (
            <div className="grid grid-cols-4 gap-2">
              {[{ value: earliestCountdown.years, label: 'Years' }, { value: earliestCountdown.months, label: 'Months' }, { value: earliestCountdown.days, label: 'Days' }, { value: earliestCountdown.hours, label: 'Hours' }].map(({ value, label }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-2 text-center">
                  <div className="text-lg font-bold text-foreground">{value}</div>
                  <div className="text-[9px] text-muted-foreground uppercase">{label}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gain font-medium text-sm">✅ You are already eligible!</p>
          )}
        </div>
      )}

      {/* Milestones (relative to planned/primary) */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Upcoming Milestones</h3>
        <div className="space-y-2">
          {MILESTONES.map(m => {
            const reached = primaryCountdown && primaryCountdown.totalDays <= m.days;
            const upcoming = primaryCountdown && primaryCountdown.totalDays <= m.days + 365;
            return (
              <div key={m.label} className={`flex items-center gap-3 p-2 rounded-lg ${reached ? 'bg-gain/10' : upcoming ? 'bg-primary/5' : 'opacity-40'}`}>
                <span className="text-lg">{m.emoji}</span>
                <span className="text-sm flex-1">{m.label} to retirement</span>
                {reached
                  ? <span className="text-xs font-semibold text-gain">✓ Reached</span>
                  : upcoming
                    ? <span className="text-xs text-primary font-medium">Coming up!</span>
                    : <span className="text-xs text-muted-foreground">{primaryCountdown ? `${(primaryCountdown.totalDays - m.days).toLocaleString()}d away` : ''}</span>
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Info } from 'lucide-react';
import { calcAnnuityAt, addYearsMonths, calcEarliestFERSRetirement, calcEarliestCSRSRetirement } from '@/lib/retirementCalc';
import { getMRA } from '@/lib/tspFunds';

/**
 * What working longer is actually worth.
 *
 * The pension already moved with the planned retirement date — every figure on
 * this tab derives from it — but seeing that meant editing the date, reading a
 * number off another card, editing it back, and holding the difference in your
 * head. The thing worth knowing is the comparison itself, so it is shown
 * directly.
 *
 * Under FERS the interesting part isn't the slope, it's the step: the
 * multiplier goes from 1.0% to 1.1% at age 62 with 20+ years of creditable
 * service, which is worth roughly five times an ordinary extra year. That step
 * is invisible in a single number and obvious in a table, which is the whole
 * reason this exists.
 */

const fmtMoney = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;
const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export default function RetirementAgeComparison({ profile, onSelectDate }) {
  const dob = profile?.date_of_birth ? new Date(profile.date_of_birth) : null;
  const careerStart = profile?.career_start_date ? new Date(profile.career_start_date) : null;

  const rows = useMemo(() => {
    if (!dob || !careerStart) return [];

    // Start at the earliest date they can actually go, not an arbitrary age —
    // an age below eligibility isn't a choice, so offering it would be noise.
    const earliest = profile?.retirement_system === 'CSRS'
      ? calcEarliestCSRSRetirement(dob, careerStart)
      : calcEarliestFERSRetirement(dob, careerStart);
    const earliestDate = earliest?.earliest?.date;
    if (!earliestDate) return [];

    const mra = getMRA(dob.getFullYear());
    const startAge = Math.max(Math.ceil((earliestDate - dob) / (1000 * 60 * 60 * 24 * 365.25)), Math.floor(mra));

    const out = [];
    for (let age = startAge; age <= startAge + 8 && age <= 70; age++) {
      const date = addYearsMonths(dob, age);
      if (date < earliestDate) continue;
      const a = calcAnnuityAt(profile, date);
      if (!a) continue;
      out.push({ age, date, ...a });
    }
    return out;
  }, [profile, dob, careerStart]);

  if (rows.length === 0) return null;

  const base = rows[0];
  const plannedDate = profile?.planned_retirement_date ? String(profile.planned_retirement_date) : null;

  // The row where the FERS multiplier first steps up, if it happens in range.
  const stepIndex = rows.findIndex((r, i) => i > 0 && r.multiplier > rows[i - 1].multiplier);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">If you stay longer</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Your pension at each retirement age. Tap a row to plan for it.
      </p>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium pb-2">Age</th>
              <th className="text-right font-medium pb-2">Service</th>
              <th className="text-right font-medium pb-2">Monthly</th>
              <th className="text-right font-medium pb-2">vs {base.age}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const iso = r.date.toISOString().split('T')[0];
              const isPlanned = plannedDate === iso;
              const delta = r.annualPension - base.annualPension;
              return (
                <motion.tr
                  key={r.age}
                  onClick={() => onSelectDate?.(iso)}
                  whileTap={{ scale: 0.99 }}
                  className={`border-t border-border/50 cursor-pointer transition-colors ${
                    isPlanned ? 'bg-primary/10' : 'hover:bg-secondary/40'
                  }`}
                >
                  <td className="py-2">
                    <span className={`font-semibold ${isPlanned ? 'text-primary' : ''}`}>{r.age}</span>
                    <span className="text-muted-foreground ml-1.5">{fmtDate(r.date)}</span>
                    {isPlanned && <span className="ml-1.5 text-[10px] text-primary font-medium">PLANNED</span>}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{r.totalCreditableService.toFixed(1)}y</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{fmtMoney(r.monthlyPension)}</td>
                  <td className={`py-2 text-right tabular-nums ${delta > 0 ? 'text-gain' : 'text-muted-foreground'}`}>
                    {i === 0 ? '—' : `+${fmtMoney(delta)}/yr`}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stepIndex > 0 && (
        <div className="mt-3 flex gap-2 p-2.5 rounded-lg bg-gain/10 border border-gain/20">
          <Info className="w-3.5 h-3.5 text-gain shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <span className="font-semibold">Age {rows[stepIndex].age} is a step, not a slope.</span>{' '}
            The FERS multiplier goes from 1.0% to 1.1% at 62 with 20+ years of creditable service, so that one
            year is worth{' '}
            <span className="font-semibold text-gain">
              {fmtMoney(rows[stepIndex].annualPension - rows[stepIndex - 1].annualPension)}/yr
            </span>{' '}
            against{' '}
            {fmtMoney(
              stepIndex > 1
                ? rows[stepIndex - 1].annualPension - rows[stepIndex - 2].annualPension
                : 0
            )}
            /yr for the year before it.
          </p>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
        Uses your High-3 of {fmtMoney(base.high3)} as entered. Staying longer usually raises High-3 too, which this
        can&apos;t know — update your three salary years and these figures go up with them.
        {base.sickLeaveYears > 0 && ` Includes ${base.sickLeaveYears.toFixed(2)} years of sick leave credit.`}
      </p>
    </div>
  );
}

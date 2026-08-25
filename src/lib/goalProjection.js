/**
 * Shared balance-goal projection.
 *
 * The Home screen's Goal Progress card and the Retire tab's Goal Timeline both
 * answer "when do I hit my goal at my current pace?" — they used to each carry
 * their own copy of the math (9% vs 7% return, two different monthly-contribution
 * helpers) and showed different dates for the same profile. Both now call in here
 * so there is one answer.
 */

import { PAY_PERIODS, resolveContrib } from '@/lib/contributionCalc';

/** App-wide default when the user hasn't set a rate in Settings > Balance Goal. */
export const DEFAULT_ANNUAL_RETURN = 7;

/** Projections stop here (50 years) — past this the goal is treated as unreachable. */
export const MAX_PROJECTION_MONTHS = 600;

/** Annual return % to project with, matching the rest of the app's calculators. */
export function getAnnualReturn(profile) {
  return profile?.fixed_annual_return || DEFAULT_ANNUAL_RETURN;
}

/**
 * Employee contributions in $/month, derived from the live contribution settings
 * (percent or dollar mode, on the profile's real pay schedule). Agency match and
 * auto-1% are deliberately excluded — the goal cards project employee pace only.
 */
export function getMonthlyContrib(profile) {
  if (!profile) return 0;
  const salary = profile.current_annual_salary || 0;
  const paySchedule = profile.pay_schedule || 'biweekly';
  const periodsPerYear = PAY_PERIODS[paySchedule] || 26;

  const trad = resolveContrib(
    profile.contrib_traditional_mode || 'percent',
    profile.contrib_traditional_percent || 0,
    profile.contrib_traditional_dollar || 0,
    salary, paySchedule
  );
  const roth = resolveContrib(
    profile.contrib_roth_mode || 'percent',
    profile.contrib_roth_percent || 0,
    profile.contrib_roth_dollar || 0,
    salary, paySchedule
  );

  return (trad.dollar + roth.dollar) * periodsPerYear / 12;
}

/**
 * Months of compounding until `balance` reaches `goal`.
 * Returns { months, reached, date } — date is null when the goal isn't reached
 * within MAX_PROJECTION_MONTHS, or when it's already met (months 0).
 */
export function projectToGoal(balance, monthlyContrib, goal, annualReturn = DEFAULT_ANNUAL_RETURN) {
  const monthlyRate = annualReturn / 100 / 12;
  let bal = balance || 0;
  let months = 0;
  while (bal < goal && months < MAX_PROJECTION_MONTHS) {
    bal = bal * (1 + monthlyRate) + monthlyContrib;
    months++;
  }
  const reached = bal >= goal;
  return { months, reached, date: reached && months > 0 ? monthsFromNow(months) : null };
}

/**
 * Single entry point used by the goal cards: everything derived from the profile,
 * so both screens agree by construction.
 */
export function projectGoalFromProfile(profile, balance, goalOverride) {
  const goal = goalOverride || profile?.balance_goal || 1_000_000;
  const monthlyContrib = getMonthlyContrib(profile);
  const annualReturn = getAnnualReturn(profile);
  const projection = projectToGoal(balance, monthlyContrib, goal, annualReturn);
  return { ...projection, goal, monthlyContrib, annualReturn };
}

export function monthsFromNow(months) {
  const target = new Date();
  target.setMonth(target.getMonth() + months);
  return target;
}

/** "Mar 2031" */
export function formatGoalDate(date) {
  if (!date) return null;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

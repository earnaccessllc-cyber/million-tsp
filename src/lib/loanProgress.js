/**
 * How far along a TSP loan is.
 *
 * This used to be a stored counter: loan.repaid started at zero and the nightly
 * price job added one payment to it every pay day. Two things were wrong with
 * that. Nothing could ever set the starting point, so a loan years into
 * repayment read 0% paid off until it had been tracked from scratch. And
 * because the balance job caps each period's repayment at
 * `original_amount - repaid`, an understated counter meant it kept crediting
 * repayments to the balance long after the loan was actually settled.
 *
 * Progress is not really state — it is a function of three things the profile
 * already knows: when the loan started, what comes out each pay period, and
 * which days are pay days. Deriving it is self-correcting, needs no backfill,
 * and cannot drift from reality just because the job missed a night.
 *
 * A caveat this model inherits and does not try to solve: a TSP loan payment is
 * principal plus interest, so payments-to-date is not strictly principal
 * repaid. `original_amount` is treated as the total to be repaid, which is how
 * the rest of the app has always used it, and is close enough for a progress
 * bar. It is not an amortization schedule.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Local midnight, so date maths can't be knocked about by the clock time. */
function atMidnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : atMidnight(d);
}

/**
 * How many pay days have fallen in (start, asOf].
 *
 * The first payment comes out on the first pay day AFTER the loan starts — a
 * loan taken out mid-period isn't repaid the same day — so the start date
 * itself is excluded even when it happens to land on a pay day.
 */
export function payPeriodsBetween(startDate, asOf, paySchedule = 'biweekly', anchorDateStr = null) {
  const start = parseDate(startDate);
  const end = parseDate(asOf) || atMidnight(new Date());
  if (!start || end <= start) return 0;

  if (paySchedule === 'monthly') {
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }

  const anchor = parseDate(anchorDateStr);
  if (anchor) {
    // Walk back from the most recent pay day on or before `end` to the first one
    // after `start`, on the real 14-day cycle the anchor pins.
    const daysSinceAnchor = Math.floor((end - anchor) / DAY);
    const backToPayDay = ((daysSinceAnchor % 14) + 14) % 14;
    const lastPayDay = new Date(end.getTime() - backToPayDay * DAY);
    if (lastPayDay <= start) return 0;
    // Pay days are lastPayDay - 14k. Counting those strictly after `start` is
    // ceil, not floor-plus-one: floor-plus-one double counts when the loan
    // starts exactly on a pay day, which is the common case for a loan taken
    // out at the start of a pay period.
    return Math.ceil((lastPayDay - start) / (14 * DAY));
  }

  // No known pay calendar: a 14-day cycle from the start date is the best
  // estimate available, and is what the rest of the app falls back to.
  return Math.floor((end - start) / (14 * DAY));
}

/**
 * @param loan     one entry from profile.loans
 * @param profile  the tsp_profiles row (for pay_schedule / pay_date_anchor)
 * @param asOf     defaults to today
 *
 * Returns null when there isn't enough on the loan to say anything.
 */
export function calcLoanProgress(loan, profile, asOf = null) {
  const original = parseFloat(loan?.original_amount) || 0;
  const perPeriod = parseFloat(loan?.per_period_payment) || 0;
  if (original <= 0) return null;

  const periodsElapsed = payPeriodsBetween(
    loan?.start_date,
    asOf,
    profile?.pay_schedule || 'biweekly',
    profile?.pay_date_anchor || null
  );

  // An explicitly entered figure wins. It covers what the derivation can't
  // know: extra payments, a re-amortized loan, a payroll gap. Blank means
  // "work it out for me", which is the normal case.
  const override = loan?.repaid === '' || loan?.repaid === null || loan?.repaid === undefined
    ? null
    : parseFloat(loan.repaid);
  const hasOverride = override !== null && !isNaN(override) && override > 0;

  const derived = Math.min(periodsElapsed * perPeriod, original);
  const repaid = Math.min(hasOverride ? override : derived, original);
  const remaining = Math.max(0, original - repaid);
  const periodsRemaining = perPeriod > 0 ? Math.ceil(remaining / perPeriod) : null;

  let payoffDate = null;
  if (periodsRemaining !== null && periodsRemaining > 0 && (profile?.pay_schedule || 'biweekly') === 'biweekly') {
    const anchor = parseDate(profile?.pay_date_anchor);
    const base = anchor || atMidnight(new Date());
    const today = atMidnight(new Date());
    const daysSince = Math.floor((today - base) / DAY);
    const toNextPayDay = ((14 - (((daysSince % 14) + 14) % 14)) % 14) || 14;
    payoffDate = new Date(today.getTime() + (toNextPayDay + (periodsRemaining - 1) * 14) * DAY);
  }

  return {
    periodsElapsed,
    derived,
    repaid,
    remaining,
    isOverridden: hasOverride,
    pct: Math.min(100, (repaid / original) * 100),
    periodsRemaining,
    payoffDate,
    isPaidOff: remaining <= 0,
  };
}

/** Total still owed across every loan — what a payoff would cost today. */
export function totalRemaining(profile) {
  const loans = Array.isArray(profile?.loans) ? profile.loans : [];
  return loans.reduce((sum, l) => {
    const p = calcLoanProgress(l, profile);
    return sum + (p ? p.remaining : 0);
  }, 0);
}

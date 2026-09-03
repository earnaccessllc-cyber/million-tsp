/**
 * How far along a TSP loan is.
 *
 * Two earlier models were wrong, in opposite directions.
 *
 * First it was a stored counter: loan.repaid started at zero and the nightly
 * price job added a payment each pay day. Nothing could set the starting point,
 * so a loan years into repayment read 0% paid off.
 *
 * Then it was payments x count. That is not principal either — a TSP loan
 * payment is principal PLUS interest, so counting payments credits the interest
 * as if it had paid the loan down. Checked against tsp.gov it overstated
 * progress badly: $1,863.91 remaining against a real $2,807.31 on one loan, and
 * $5,146.50 against a real $8,938.82 on the other.
 *
 * A TSP loan is an ordinary level-payment amortizing loan, so the balance after
 * n payments is the standard closed form:
 *
 *     B(n) = P(1+i)^n - PMT * ((1+i)^n - 1) / i
 *
 * That reproduces tsp.gov's Remaining Principal Amount to the cent on both
 * loans, which is the test that matters.
 *
 * The rate is the missing input, and tsp.gov doesn't put it on the loan summary.
 * Rather than ask for a number that isn't in front of the participant, the rate
 * is solved from one that is: enter the Remaining Principal Amount off tsp.gov
 * and the implied rate falls out, after which the balance can be carried forward
 * on its own. Without a reading, DEFAULT_ANNUAL_RATE is used and the result is
 * marked an estimate rather than quietly presented as fact.
 *
 * Note the interest is not lost to the participant — a TSP loan repayment goes
 * back into their own account — so the amount credited to the balance each pay
 * period is still the whole payment. It just isn't all principal, which is the
 * distinction this file exists to keep straight.
 */

const DAY = 24 * 60 * 60 * 1000;

// TSP loan interest is fixed at the G Fund rate when the loan is taken out.
// Used only until a real Remaining Principal reading calibrates the loan.
const DEFAULT_ANNUAL_RATE = 4.0;

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
    const daysSinceAnchor = Math.floor((end - anchor) / DAY);
    const backToPayDay = ((daysSinceAnchor % 14) + 14) % 14;
    const lastPayDay = new Date(end.getTime() - backToPayDay * DAY);
    if (lastPayDay <= start) return 0;
    // Pay days are lastPayDay - 14k. Counting those strictly after `start` is
    // ceil, not floor-plus-one: floor-plus-one double counts when the loan
    // starts exactly on a pay day, which is the common case.
    return Math.ceil((lastPayDay - start) / (14 * DAY));
  }

  return Math.floor((end - start) / (14 * DAY));
}

/** Principal still owed after n level payments at periodic rate i. */
export function balanceAfter(principal, payment, periodicRate, n) {
  if (n <= 0) return principal;
  if (periodicRate <= 0) return Math.max(0, principal - payment * n);
  const growth = Math.pow(1 + periodicRate, n);
  return principal * growth - payment * ((growth - 1) / periodicRate);
}

/**
 * The periodic rate implied by a known balance — bisection rather than algebra
 * because there is no closed form for i, and the function is monotonic in i so
 * bisection is exact enough in a fixed number of steps.
 */
export function solvePeriodicRate(principal, payment, n, remaining) {
  if (!(n > 0) || !(principal > 0) || !(payment > 0)) return null;
  // A balance at or above the zero-interest case can't be explained by a
  // non-negative rate; below it, no rate in a sane range reaches it.
  if (remaining <= balanceAfter(principal, payment, 0, n)) return 0;
  let lo = 0;
  let hi = 0.02; // ~52%/yr — far past any plausible G Fund rate
  if (balanceAfter(principal, payment, hi, n) < remaining) return hi;
  for (let k = 0; k < 100; k += 1) {
    const mid = (lo + hi) / 2;
    if (balanceAfter(principal, payment, mid, n) < remaining) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Payments needed to clear the loan, or null if the payment never amortizes it. */
function termInPeriods(principal, payment, periodicRate) {
  if (periodicRate <= 0) return Math.ceil(principal / payment);
  // A payment that doesn't cover the first period's interest never pays it off.
  if (payment <= principal * periodicRate) return null;
  const n = Math.log(payment / (payment - principal * periodicRate)) / Math.log(1 + periodicRate);
  return Math.ceil(n);
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
  if (original <= 0 || perPeriod <= 0) return null;

  const paySchedule = profile?.pay_schedule || 'biweekly';
  const anchor = profile?.pay_date_anchor || null;
  const periodsElapsed = payPeriodsBetween(loan?.start_date, asOf, paySchedule, anchor);

  const perYear = paySchedule === 'monthly' ? 12 : 26;

  // Where the rate comes from, most authoritative first.
  //
  //   entered    the rate off the loan agreement. It IS the loan's rate, so
  //              nothing should second-guess it.
  //   matched    solved from a Remaining Principal Amount read off tsp.gov,
  //              for someone who has the balance to hand but not the rate.
  //   estimated  neither given: a typical G Fund rate, flagged as a guess.
  //
  // principal_as_of records the day a reading was taken, so the balance is
  // carried forward from that point rather than assumed current forever.
  const entered = parseFloat(loan?.interest_rate);
  const hasEntered = !isNaN(entered) && entered > 0
    && loan?.interest_rate !== '' && loan?.interest_rate !== null;

  const reading = parseFloat(loan?.remaining_principal);
  const hasReading = !isNaN(reading) && reading >= 0
    && loan?.remaining_principal !== '' && loan?.remaining_principal !== null;

  const nAtReading = hasReading
    ? payPeriodsBetween(loan?.start_date, loan?.principal_as_of || asOf, paySchedule, anchor)
    : 0;
  const solved = hasReading ? solvePeriodicRate(original, perPeriod, nAtReading, reading) : null;

  let periodicRate = DEFAULT_ANNUAL_RATE / 100 / perYear;
  let rateSource = 'estimated';
  if (hasEntered) {
    periodicRate = entered / 100 / perYear;
    rateSource = 'entered';
  } else if (solved !== null) {
    periodicRate = solved;
    rateSource = 'matched';
  }

  // When both are given they are independent facts about the same loan, so a
  // disagreement means one of them is mistyped. Surfacing the balance the
  // entered rate implies lets that be seen rather than silently believed.
  const impliedByEnteredRate = (hasEntered && hasReading)
    ? Math.max(0, balanceAfter(original, perPeriod, periodicRate, nAtReading))
    : null;

  const remaining = Math.max(0, balanceAfter(original, perPeriod, periodicRate, periodsElapsed));
  const principalRepaid = Math.max(0, original - remaining);
  const term = termInPeriods(original, perPeriod, periodicRate);
  const periodsRemaining = term === null ? null : Math.max(0, term - periodsElapsed);

  let payoffDate = null;
  if (periodsRemaining !== null && periodsRemaining > 0 && paySchedule === 'biweekly') {
    const base = parseDate(anchor) || atMidnight(new Date());
    const today = atMidnight(new Date());
    const daysSince = Math.floor((today - base) / DAY);
    const toNextPayDay = ((14 - (((daysSince % 14) + 14) % 14)) % 14) || 14;
    payoffDate = new Date(today.getTime() + (toNextPayDay + (periodsRemaining - 1) * 14) * DAY);
  }

  return {
    periodsElapsed,
    remaining,
    principalRepaid,
    // What has actually left the paycheck — principal plus the interest, which
    // on a TSP loan is paid back to the participant's own account.
    totalPaid: Math.min(periodsElapsed, term ?? periodsElapsed) * perPeriod,
    interestPaid: Math.max(0, Math.min(periodsElapsed, term ?? periodsElapsed) * perPeriod - principalRepaid),
    annualRate: periodicRate * perYear * 100,
    rateSource,
    // True when an entered rate and a tsp.gov reading disagree by more than a
    // dollar — almost always a typo in one of them.
    rateConflict: impliedByEnteredRate !== null && Math.abs(impliedByEnteredRate - reading) > 1,
    readingImplies: impliedByEnteredRate,
    reading: hasReading ? reading : null,
    pct: Math.min(100, (principalRepaid / original) * 100),
    periodsRemaining,
    term,
    payoffDate,
    isPaidOff: remaining <= 0.005,
  };
}

/** Total principal still owed across every loan. */
export function totalRemaining(profile) {
  const loans = Array.isArray(profile?.loans) ? profile.loans : [];
  return loans.reduce((sum, l) => {
    const p = calcLoanProgress(l, profile);
    return sum + (p ? p.remaining : 0);
  }, 0);
}

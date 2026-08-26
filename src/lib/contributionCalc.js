/**
 * Contribution calculation utilities for TSP Millionaire
 */

export const PAY_PERIODS = { biweekly: 26, monthly: 12 };
export const IRS_LIMIT_2026 = 23500;

/**
 * Returns number of pay periods elapsed since Jan 1 of current year (through today).
 * When a real pay_date_anchor is known, counts actual pay dates on that real
 * biweekly cycle instead of assuming alignment to Jan 1 — agencies' real pay
 * calendars don't land on a generic Jan-1-based 14-day grid, so the generic
 * estimate can be off by a full pay period (mirrors dailyPriceUpdate's
 * anchor-based isPayDay on the backend, which this must stay consistent with).
 */
export function getPeriodsElapsed(paySchedule = 'biweekly', anchorDateStr = null) {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);

  if (paySchedule === 'monthly') {
    return now.getMonth(); // 0 = Jan (no full period yet), etc.
  }

  if (anchorDateStr) {
    const anchor = new Date(anchorDateStr + 'T00:00:00');
    const diffDays = Math.floor((now - anchor) / (1000 * 60 * 60 * 24));
    const daysSinceMostRecentPayDay = ((diffDays % 14) + 14) % 14;
    let payDate = new Date(now.getTime() - daysSinceMostRecentPayDay * 24 * 60 * 60 * 1000);
    let count = 0;
    while (payDate >= jan1) {
      count++;
      payDate = new Date(payDate.getTime() - 14 * 24 * 60 * 60 * 1000);
    }
    return count;
  }

  // Fallback when no real pay date is known yet: generic Jan-1-anchored estimate.
  const dayOfYear = Math.floor((now - jan1) / (1000 * 60 * 60 * 24));
  return Math.floor(dayOfYear / 14);
}

/**
 * Convert % to $/period
 */
export function pctToDollar(pct, salary, paySchedule = 'biweekly') {
  const periods = PAY_PERIODS[paySchedule] || 26;
  return (salary * (pct / 100)) / periods;
}

/**
 * Convert $/period to %
 */
export function dollarToPct(dollarPerPeriod, salary, paySchedule = 'biweekly') {
  const periods = PAY_PERIODS[paySchedule] || 26;
  if (!salary) return 0;
  return (dollarPerPeriod * periods / salary) * 100;
}

/**
 * Get both % and $/period for a contribution field, regardless of mode stored
 */
export function resolveContrib(mode, pct, dollar, salary, paySchedule) {
  const periods = PAY_PERIODS[paySchedule] || 26;
  if (mode === 'percent') {
    const p = pct || 0;
    const d = salary ? (salary * (p / 100)) / periods : (dollar || 0);
    return { pct: p, dollar: d };
  } else {
    const d = dollar || 0;
    const p = salary ? (d * periods / salary) * 100 : (pct || 0);
    return { pct: p, dollar: d };
  }
}

/**
 * The agency type to actually calculate with.
 * retirement_system (Retirement tab) and agency_type (Settings > Contributions) are set
 * independently — a CSRS employee could leave agency_type at its 'usps' default without ever
 * touching that dropdown. CSRS never gets agency match/auto 1%, so it always overrides here.
 */
export function resolveAgencyType(profile) {
  return profile?.retirement_system === 'CSRS' ? 'csrs' : (profile?.agency_type || 'usps');
}

/**
 * Calculate agency match per pay period and as % of salary
 * Returns { matchDollar, matchPct, auto1Dollar, auto1Pct }
 */
export function calcAgencyMatch(agencyType, employeePct, salary, paySchedule = 'biweekly') {
  const periods = PAY_PERIODS[paySchedule] || 26;

  if (agencyType === 'csrs') {
    return { matchDollar: 0, matchPct: 0, auto1Dollar: 0, auto1Pct: 0 };
  }

  if (agencyType === 'usps') {
    // USPS lookup table — total agency contribution (includes auto 1%)
    let agencyPct = 0;
    const e = employeePct;
    if (e <= 0) agencyPct = 1;
    else if (e <= 1) agencyPct = 2;
    else if (e <= 2) agencyPct = 3;
    else if (e <= 3) agencyPct = 4;
    else if (e <= 4) agencyPct = 4.5;
    else agencyPct = 5;

    const matchDollar = salary ? (salary * (agencyPct / 100)) / periods : 0;
    return { matchDollar, matchPct: agencyPct, auto1Dollar: 0, auto1Pct: 0, combined: true };
  }

  // Standard FERS
  const auto1Pct = 1;
  const auto1Dollar = salary ? (salary * 0.01) / periods : 0;

  const matchOn3 = Math.min(employeePct, 3);
  const matchOn2 = Math.min(Math.max(employeePct - 3, 0), 2) * 0.5;
  const matchPct = matchOn3 + matchOn2;
  const matchDollar = salary ? (salary * (matchPct / 100)) / periods : 0;

  return { matchDollar, matchPct, auto1Dollar, auto1Pct };
}

/**
 * Calculate full YTD contribution summary from profile
 */
export function calcYTD(profile) {
  const salary = profile?.current_annual_salary || 0;
  const paySchedule = profile?.pay_schedule || 'biweekly';
  const agencyType = resolveAgencyType(profile);
  const periods = PAY_PERIODS[paySchedule] || 26;
  const periodsElapsed = getPeriodsElapsed(paySchedule, profile?.pay_date_anchor);

  const trad = resolveContrib(
    profile?.contrib_traditional_mode || 'percent',
    profile?.contrib_traditional_percent || 0,
    profile?.contrib_traditional_dollar || 0,
    salary, paySchedule
  );

  const roth = resolveContrib(
    profile?.contrib_roth_mode || 'percent',
    profile?.contrib_roth_percent || 0,
    profile?.contrib_roth_dollar || 0,
    salary, paySchedule
  );

  const employeePct = trad.pct + roth.pct;
  const agency = calcAgencyMatch(agencyType, employeePct, salary, paySchedule);

  // Derived from the real loans array (each loan's own per_period_payment) rather
  // than the legacy standalone contrib_loan_per_period field, which isn't kept in
  // sync when loans are added/edited and had drifted from the real total.
  const loans = Array.isArray(profile?.loans) ? profile.loans : [];
  const loanPerPeriod = loans.reduce((s, l) => s + (parseFloat(l.per_period_payment) || 0), 0);

  const tradYTD = trad.dollar * periodsElapsed;
  const rothYTD = roth.dollar * periodsElapsed;
  const matchYTD = agency.matchDollar * periodsElapsed;
  const auto1YTD = (agency.auto1Dollar || 0) * periodsElapsed;
  const loanYTD = loanPerPeriod * periodsElapsed;

  return {
    periodsElapsed,
    periodsTotal: periods,
    trad,
    roth,
    agency,
    loanPerPeriod,
    tradYTD,
    rothYTD,
    matchYTD,
    auto1YTD,
    loanYTD,
    employeePct,
  };
}
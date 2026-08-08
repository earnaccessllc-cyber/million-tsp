import { getMRA, LIFE_EXPECTANCY_FACTORS } from '@/lib/tspFunds';

/**
 * Calculate Social Security Full Retirement Age based on birth year
 */
export function getFRA(birthYear) {
  if (birthYear <= 1954) return { years: 66, months: 0 };
  if (birthYear === 1955) return { years: 66, months: 2 };
  if (birthYear === 1956) return { years: 66, months: 4 };
  if (birthYear === 1957) return { years: 66, months: 6 };
  if (birthYear === 1958) return { years: 66, months: 8 };
  if (birthYear === 1959) return { years: 66, months: 10 };
  return { years: 67, months: 0 };
}

export function getFRADecimal(birthYear) {
  const fra = getFRA(birthYear);
  return fra.years + fra.months / 12;
}

export function getFRALabel(birthYear) {
  const fra = getFRA(birthYear);
  if (fra.months === 0) return `${fra.years} (FRA)`;
  return `${fra.years} & ${fra.months} months (FRA)`;
}

/**
 * Add years+months to a date
 */
export function addYearsMonths(date, years, months = 0) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Calculate years of service between two dates
 */
export function calcYearsOfService(startDate, endDate) {
  return (endDate - startDate) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Calculate age at a given date
 */
export function calcAgeAt(dob, date) {
  return (date - dob) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Calculate earliest FERS retirement date and which rule applies
 */
export function calcEarliestFERSRetirement(dob, careerStart) {
  if (!dob || !careerStart) return null;
  const birthYear = dob.getFullYear();
  const mra = getMRA(birthYear);
  const mraYears = Math.floor(mra);
  const mraMonths = Math.round((mra - mraYears) * 12);

  const mraDate = addYearsMonths(dob, mraYears, mraMonths);
  const age60Date = addYearsMonths(dob, 60);
  const age62Date = addYearsMonths(dob, 62);

  const candidates = [];

  // MRA + 30 years
  const mra30ServiceDate = addYearsMonths(careerStart, 30);
  const mra30Date = mra30ServiceDate > mraDate ? mra30ServiceDate : mraDate;
  if (calcAgeAt(dob, mra30Date) >= mra && calcYearsOfService(careerStart, mra30Date) >= 30) {
    candidates.push({ date: mra30Date, rule: `MRA (${mraYears}y${mraMonths > 0 ? ' ' + mraMonths + 'm' : ''}) + 30 years service` });
  } else {
    // find the later of MRA date and 30yr service date
    const eligible = new Date(Math.max(mraDate, mra30ServiceDate));
    candidates.push({ date: eligible, rule: `MRA (${mraYears}y${mraMonths > 0 ? ' ' + mraMonths + 'm' : ''}) + 30 years service` });
  }

  // Age 60 + 20 years service
  const svc20Date = addYearsMonths(careerStart, 20);
  const age60_20Date = age60Date > svc20Date ? age60Date : svc20Date;
  candidates.push({ date: age60_20Date, rule: 'Age 60 with 20 years service' });

  // Age 62 + 5 years service
  const svc5Date = addYearsMonths(careerStart, 5);
  const age62_5Date = age62Date > svc5Date ? age62Date : svc5Date;
  candidates.push({ date: age62_5Date, rule: 'Age 62 with 5 years service' });

  // MRA + 10 (reduced)
  const svc10Date = addYearsMonths(careerStart, 10);
  const mra10Date = mraDate > svc10Date ? mraDate : svc10Date;
  candidates.push({ date: mra10Date, rule: `MRA + 10 years service (reduced pension)`, reduced: true });

  // Sort by date, prefer non-reduced first
  const nonReduced = candidates.filter(c => !c.reduced).sort((a, b) => a.date - b.date);
  const reduced = candidates.filter(c => c.reduced).sort((a, b) => a.date - b.date);

  const earliest = nonReduced[0] || reduced[0];
  const earliestOverall = [...candidates].sort((a, b) => a.date - b.date)[0];

  return {
    earliest: earliest,
    earliestOverall: earliestOverall,
    all: candidates.sort((a, b) => a.date - b.date),
  };
}

/**
 * Calculate earliest CSRS retirement date
 */
export function calcEarliestCSRSRetirement(dob, careerStart) {
  if (!dob || !careerStart) return null;

  const candidates = [];

  // Age 55 + 30 years
  const age55Date = addYearsMonths(dob, 55);
  const svc30Date = addYearsMonths(careerStart, 30);
  candidates.push({ date: new Date(Math.max(age55Date, svc30Date)), rule: 'Age 55 with 30 years service' });

  // Age 60 + 20 years
  const age60Date = addYearsMonths(dob, 60);
  const svc20Date = addYearsMonths(careerStart, 20);
  candidates.push({ date: new Date(Math.max(age60Date, svc20Date)), rule: 'Age 60 with 20 years service' });

  // Age 62 + 5 years
  const age62Date = addYearsMonths(dob, 62);
  const svc5Date = addYearsMonths(careerStart, 5);
  candidates.push({ date: new Date(Math.max(age62Date, svc5Date)), rule: 'Age 62 with 5 years service' });

  candidates.sort((a, b) => a.date - b.date);
  return { earliest: candidates[0], all: candidates };
}

/**
 * Calculate SS adjusted benefit based on claiming age vs FRA
 */
export function calcAdjustedSSBenefit(baseBenefit, claimingAge, birthYear) {
  if (!baseBenefit || !claimingAge || !birthYear) return baseBenefit || 0;
  const fra = getFRADecimal(birthYear);
  const diffMonths = Math.round((claimingAge - fra) * 12);

  if (diffMonths === 0) return baseBenefit;
  if (diffMonths < 0) {
    // Early: -0.556%/month
    return baseBenefit * (1 + diffMonths * 0.00556);
  } else {
    // Delayed: +0.667%/month (8%/year)
    const cappedMonths = Math.min(diffMonths, (70 - fra) * 12);
    return baseBenefit * (1 + cappedMonths * 0.00667);
  }
}

/**
 * Project TSP balance to a future date, accounting for contributions and growth.
 * Uses monthly compounding with contributions.
 */
export function projectTSPBalance(currentBalance, profile, yearsToRetirement) {
  if (!yearsToRetirement || yearsToRetirement <= 0) return currentBalance;
  const annualReturn = (profile?.fixed_annual_return || 7) / 100;
  const monthlyRate = annualReturn / 12;
  const months = Math.round(yearsToRetirement * 12);
  const monthlyContrib = (
    (profile?.traditional_contributions || 0) +
    (profile?.roth_contributions || 0) +
    (profile?.agency_match || 0) +
    (profile?.auto_1_percent || 0)
  ) / 12;

  let bal = currentBalance;
  for (let i = 0; i < months; i++) {
    bal = bal * (1 + monthlyRate) + monthlyContrib;
  }
  return bal;
}

/**
 * Convert sick leave hours to years of additional service credit (OPM formula)
 */
export function sickLeaveToYears(hours) {
  if (!hours || hours <= 0) return 0;
  return hours / 2087;
}

/**
 * Get sick leave credit breakdown for display
 */
export function getSickLeaveCredit(hours) {
  if (!hours || hours <= 0) return { years: 0, months: 0, days: 0, decimal: 0 };
  const decimal = hours / 2087;
  const years = Math.floor(decimal);
  const remainingHours = hours - years * 2087;
  const months = Math.floor(remainingHours / 174);
  const remainingAfterMonths = remainingHours - months * 174;
  const days = Math.floor(remainingAfterMonths / (174 / 30));
  return { years, months, days, decimal };
}

/**
 * Main retirement calculation function
 * Uses planned retirement date if available, otherwise current date
 */
export function calcRetirement(profile, tspBalance) {
  if (!profile?.date_of_birth || !profile?.career_start_date) return null;

  const dob = new Date(profile.date_of_birth);
  const careerStart = new Date(profile.career_start_date);
  const now = new Date();
  const birthYear = dob.getFullYear();

  // Retirement date: use planned if set, otherwise now
  const retirementDate = profile.planned_retirement_date
    ? new Date(profile.planned_retirement_date)
    : now;

  const ageAtRetirement = calcAgeAt(dob, retirementDate);
  const yearsOfService = calcYearsOfService(careerStart, retirementDate);
  const currentAge = calcAgeAt(dob, now);

  // Sick leave credit (pension calculation only, not eligibility)
  const sickLeaveHours = profile.sick_leave_estimated_hours || profile.sick_leave_current_hours || 0;
  const sickLeaveYears = sickLeaveToYears(sickLeaveHours);
  const sickLeaveCredit = getSickLeaveCredit(sickLeaveHours);
  const totalCreditableService = yearsOfService + sickLeaveYears;

  // High-3 calculation
  const salaries = [profile.salary_year_1, profile.salary_year_2, profile.salary_year_3].filter(s => s > 0);
  const high3 = salaries.length > 0
    ? salaries.reduce((a, b) => a + b, 0) / salaries.length
    : profile.current_annual_salary || 0;

  // Pension calculation — use totalCreditableService (includes sick leave)
  let annualPension = 0;
  let pensionFormula = '';

  if (profile.retirement_system === 'FERS') {
    // Sick leave counts toward the 20-year threshold for the 1.1% multiplier — it's part of
    // total creditable service used throughout the annuity computation (just not for eligibility).
    const multiplier = (ageAtRetirement >= 62 && totalCreditableService >= 20) ? 0.011 : 0.01;
    annualPension = multiplier * totalCreditableService * high3;
    pensionFormula = `${(multiplier * 100).toFixed(1)}% × ${totalCreditableService.toFixed(2)} yrs × High-3`;
  } else {
    const yos = Math.min(totalCreditableService, 41.11);
    if (yos <= 5) annualPension = 0.015 * yos * high3;
    else if (yos <= 10) annualPension = (0.015 * 5 + 0.0175 * (yos - 5)) * high3;
    else annualPension = (0.015 * 5 + 0.0175 * 5 + 0.02 * (yos - 10)) * high3;
    pensionFormula = 'CSRS tiered formula';
  }
  const monthlyPension = annualPension / 12;

  // Earliest retirement
  const mra = getMRA(birthYear);
  const earliest = profile.retirement_system === 'FERS'
    ? calcEarliestFERSRetirement(dob, careerStart)
    : calcEarliestCSRSRetirement(dob, careerStart);

  // SRS (FERS only — only if retiring before 62)
  // OPM's SRS formula uses your estimated SS benefit AT AGE 62, not at FRA — ss_monthly_benefit
  // is collected "at FRA", so it must be adjusted down to age 62 before use here.
  let srsEligible = false;
  let srsAmount = 0;
  let srsReason = '';
  let srsEndDate = null;
  const ssBenefitAt62 = calcAdjustedSSBenefit(profile.ss_monthly_benefit || 0, 62, birthYear);

  if (profile.retirement_system === 'FERS') {
    const age62Date = addYearsMonths(dob, 62);
    if (ageAtRetirement < 62) {
      if ((ageAtRetirement >= mra && yearsOfService >= 30) || (ageAtRetirement >= 60 && yearsOfService >= 20)) {
        srsEligible = true;
        srsEndDate = age62Date;
        srsReason = ageAtRetirement >= 60 ? 'Age 60+ with 20+ years service' : `MRA + 30 years service`;
        if (profile.ss_monthly_benefit) {
          srsAmount = (yearsOfService / 40) * ssBenefitAt62;
        }
      } else {
        srsReason = `Not eligible: need MRA+30 years or age 60+20 years`;
      }
    } else {
      srsReason = 'Not applicable — retiring at age 62 or later';
    }
  }

  // SS claiming age
  const ssClaimingAge = profile.ss_claiming_age_years
    ? profile.ss_claiming_age_years + (profile.ss_claiming_age_months || 0) / 12
    : (profile.ss_start_age || 62);

  const fra = getFRADecimal(birthYear);
  // CSRS employment is not Social Security-covered (no FICA withholding on CSRS wages), so
  // CSRS service itself never earns a Social Security benefit — unlike FERS, which was built
  // as pension + Social Security + TSP. Exclude SS from CSRS retirement income projections.
  const isCSRS = profile.retirement_system === 'CSRS';
  const adjustedSSBenefit = isCSRS ? 0 : calcAdjustedSSBenefit(profile.ss_monthly_benefit || 0, ssClaimingAge, birthYear);
  const ssStartDate = addYearsMonths(dob, Math.floor(ssClaimingAge), Math.round((ssClaimingAge % 1) * 12));

  // Project TSP balance to retirement date (if in the future)
  const yearsToRetirement = Math.max(0, (retirementDate - now) / (1000 * 60 * 60 * 24 * 365.25));
  const projectedTSPBalance = yearsToRetirement > 0
    ? projectTSPBalance(tspBalance || 0, profile, yearsToRetirement)
    : (tspBalance || 0);

  // TSP withdrawal
  let tspMonthly = 0;
  const balance = projectedTSPBalance;
  if (profile.tsp_withdrawal_method === 'fixed_percent' && profile.tsp_withdrawal_percent) {
    tspMonthly = balance * (profile.tsp_withdrawal_percent / 100 / 12);
  } else if (profile.tsp_withdrawal_method === 'fixed_dollar' && profile.tsp_withdrawal_amount) {
    tspMonthly = profile.tsp_withdrawal_amount;
  } else if (profile.tsp_withdrawal_method === 'life_expectancy') {
    const age = Math.round(ageAtRetirement);
    const factor = LIFE_EXPECTANCY_FACTORS[age] || LIFE_EXPECTANCY_FACTORS[65];
    tspMonthly = balance / factor / 12;
  }

  // Income phases
  const age62Date = addYearsMonths(dob, 62);

  // Phase 1: retirement → min(62, ssStart)
  const phase1End = ssClaimingAge < 62 ? ssStartDate : age62Date;
  const phase1Income = {
    pension: monthlyPension,
    srs: srsEligible ? srsAmount : 0,
    tsp: tspMonthly,
    ss: ssClaimingAge < ageAtRetirement ? adjustedSSBenefit : 0,
    total: monthlyPension + (srsEligible ? srsAmount : 0) + tspMonthly + (ssClaimingAge < ageAtRetirement ? adjustedSSBenefit : 0),
    label: `Retirement → ${ssClaimingAge < 62 ? 'SS start' : 'Age 62'}`,
    startDate: retirementDate,
    endDate: phase1End,
  };

  // Phase 2: Age 62 → SS start (if SS starts after 62)
  let phase2Income = null;
  if (ssClaimingAge > 62) {
    phase2Income = {
      pension: monthlyPension,
      srs: 0,
      tsp: tspMonthly,
      ss: 0,
      total: monthlyPension + tspMonthly,
      label: 'Age 62 → SS Start',
      startDate: age62Date,
      endDate: ssStartDate,
    };
  }

  // Phase 3: SS start onward
  const phase3Income = {
    pension: monthlyPension,
    srs: 0,
    tsp: tspMonthly,
    ss: adjustedSSBenefit,
    total: monthlyPension + tspMonthly + adjustedSSBenefit,
    label: 'SS Start → Onward',
    startDate: ssStartDate,
    endDate: null,
  };

  return {
    retirementDate,
    ageAtRetirement,
    yearsOfService,
    totalCreditableService,
    sickLeaveHours,
    sickLeaveYears,
    sickLeaveCredit,
    currentAge,
    high3,
    annualPension,
    monthlyPension,
    pensionFormula,
    mra,
    earliest,
    srsEligible,
    srsAmount,
    srsReason,
    srsEndDate,
    ssBenefitAt62,
    ssClaimingAge,
    fra,
    adjustedSSBenefit,
    ssStartDate,
    tspMonthly,
    projectedTSPBalance,
    yearsToRetirement,
    phase1Income,
    phase2Income,
    phase3Income,
    dob,
    careerStart,
    birthYear,
    isPlannedSet: !!profile.planned_retirement_date,
  };
}
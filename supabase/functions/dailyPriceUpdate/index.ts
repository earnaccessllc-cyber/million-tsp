import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Fetches live TSP fund prices from the live-prices sheet and applies them
// to every profile's fund allocations, balances, and daily-balance history.
// Meant to run on a nightly schedule (Supabase Cron Trigger), not from the browser.
const LIVE_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/live%20prices';

// Maps the live-prices sheet's fund labels to the exact fund_name strings
// stored in fund_allocations (see src/lib/tspFunds.js) — core funds keep
// their "X Fund" suffix, lifecycle funds get a space before the year
// ("L2030" on the sheet -> "L 2030" in the DB).
const DISPLAY_TO_KEY = {
  'G Fund': 'G Fund', 'F Fund': 'F Fund', 'C Fund': 'C Fund', 'S Fund': 'S Fund', 'I Fund': 'I Fund',
  'L Income': 'L Income', 'L2030': 'L 2030', 'L2035': 'L 2035', 'L2040': 'L 2040',
  'L2045': 'L 2045', 'L2050': 'L 2050', 'L2055': 'L 2055', 'L2060': 'L 2060',
  'L2065': 'L 2065', 'L2070': 'L 2070', 'L2075': 'L 2075',
};

const JAN1_PRICES = {
  'G Fund': 19.5922, 'F Fund': 20.8602, 'C Fund': 109.7449, 'S Fund': 101.6677, 'I Fund': 56.0292,
  'L Income': 29.2952, 'L 2030': 58.3022, 'L 2035': 17.7506, 'L 2040': 68.0819,
  'L 2045': 18.8435, 'L 2050': 41.7575, 'L 2055': 21.5591, 'L 2060': 21.5566,
  'L 2065': 21.5541, 'L 2070': 12.7748, 'L 2075': 11.1588,
};

const MARKET_HOLIDAYS = new Set([
  '2025-01-01','2025-01-20','2025-02-17','2025-05-26','2025-06-19','2025-07-04','2025-09-01','2025-11-27','2025-12-25',
  '2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18','2027-02-15','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
]);

function isMarketDay(dateStr) {
  if (MARKET_HOLIDAYS.has(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow !== 0 && dow !== 6;
}

function isDST(date) {
  const year = date.getUTCFullYear();
  const marchSecondSun = nthSundayOfMonth(year, 2, 2);
  const novFirstSun = nthSundayOfMonth(year, 10, 1);
  return date >= marchSecondSun && date < novFirstSun;
}

function nthSundayOfMonth(year, month, n) {
  const d = new Date(Date.UTC(year, month, 1));
  const firstSunday = (7 - d.getUTCDay()) % 7;
  d.setUTCDate(1 + firstSunday + (n - 1) * 7);
  return d;
}

function parsePercent(str) {
  if (!str) return null;
  const clean = String(str).replace(/[+%\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

// Mirrors src/lib/contributionCalc.js's getPeriodsElapsed exactly, so "is this a
// pay day" lines up with the same period boundaries the rest of the app already
// uses for YTD math (14-day periods from Jan 1 for biweekly, calendar months for
// monthly). Real TSP posting timing varies by agency/payroll provider with no
// universal rule, so contributions post on the pay date itself.
const PAY_PERIODS = { biweekly: 26, monthly: 12 };

function periodsElapsed(date, paySchedule) {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - jan1) / (1000 * 60 * 60 * 24));
  if (paySchedule === 'monthly') return date.getMonth();
  return Math.floor(dayOfYear / 14);
}

// If the profile has a real known pay date (pay_date_anchor), use that to anchor
// the biweekly cycle instead of assuming alignment to Jan 1 — agencies' actual
// pay calendars don't line up with a generic Jan-1-based 14-day grid.
function isPayDay(today, paySchedule, anchorDateStr) {
  if (paySchedule === 'biweekly' && anchorDateStr) {
    const anchor = new Date(anchorDateStr + 'T00:00:00');
    const diffDays = Math.floor((today - anchor) / (1000 * 60 * 60 * 24));
    return ((diffDays % 14) + 14) % 14 === 0;
  }
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return periodsElapsed(today, paySchedule) !== periodsElapsed(yesterday, paySchedule);
}

function resolveContribPctAndDollar(mode, pct, dollar, salary, periods) {
  if (mode === 'percent') {
    const p = pct || 0;
    const d = salary ? (salary * (p / 100)) / periods : (dollar || 0);
    return { pct: p, dollar: d };
  }
  const d = dollar || 0;
  const p = salary ? (d * periods / salary) * 100 : (pct || 0);
  return { pct: p, dollar: d };
}

// Mirrors src/lib/contributionCalc.js's calcAgencyMatch dollar amount (matchDollar + auto1Dollar).
function calcAgencyMatchDollar(agencyType, employeePct, salary, periods) {
  if (agencyType === 'csrs') return 0;

  if (agencyType === 'usps') {
    const e = employeePct;
    let agencyPct;
    if (e <= 0) agencyPct = 1;
    else if (e <= 1) agencyPct = 2;
    else if (e <= 2) agencyPct = 3;
    else if (e <= 3) agencyPct = 4;
    else if (e <= 4) agencyPct = 4.5;
    else agencyPct = 5;
    return salary ? (salary * (agencyPct / 100)) / periods : 0;
  }

  const auto1Dollar = salary ? (salary * 0.01) / periods : 0;
  const matchOn3 = Math.min(employeePct, 3);
  const matchOn2 = Math.min(Math.max(employeePct - 3, 0), 2) * 0.5;
  const matchPct = matchOn3 + matchOn2;
  const matchDollar = salary ? (salary * (matchPct / 100)) / periods : 0;
  return matchDollar + auto1Dollar;
}

// Employee traditional + Roth contributions plus agency match, for whichever
// profile fields are set — the actual dollar amount to add to the balance
// on a pay day. Loan repayments are handled separately (calcLoanRepaymentDue)
// since they're capped by what's actually left owed on the loan.
function calcPayPeriodContribution(profile) {
  const salary = profile.current_annual_salary || 0;
  const paySchedule = profile.pay_schedule || 'biweekly';
  const periods = PAY_PERIODS[paySchedule] || 26;

  const trad = resolveContribPctAndDollar(
    profile.contrib_traditional_mode || 'percent',
    profile.contrib_traditional_percent || 0,
    profile.contrib_traditional_dollar || 0,
    salary, periods
  );
  const roth = resolveContribPctAndDollar(
    profile.contrib_roth_mode || 'percent',
    profile.contrib_roth_percent || 0,
    profile.contrib_roth_dollar || 0,
    salary, periods
  );

  const employeePct = trad.pct + roth.pct;
  const agencyType = profile.retirement_system === 'CSRS' ? 'csrs' : (profile.agency_type || 'usps');
  const matchDollar = calcAgencyMatchDollar(agencyType, employeePct, salary, periods);

  return trad.dollar + roth.dollar + matchDollar;
}

// TSP loan repayments (principal + interest) are deposited back into the
// account and invested per the participant's contribution allocation, same
// as a regular contribution (confirmed via tsp.gov loan guidance) — but only
// up to whatever's actually still owed on that specific loan. A profile can
// have more than one active loan (general purpose + residential, etc.), each
// tracked independently in profile.loans.
function calcLoanRepayments(profile) {
  const loans = Array.isArray(profile.loans) ? profile.loans : [];
  let total = 0;
  const updatedLoans = loans.map((loan) => {
    const perPeriod = loan.per_period_payment || 0;
    const alreadyRepaid = loan.repaid || 0;
    const remaining = Math.max(0, (loan.original_amount || 0) - alreadyRepaid);
    const due = Math.min(perPeriod, remaining);
    total += due;
    return due > 0 ? { ...loan, repaid: alreadyRepaid + due } : loan;
  });
  return { total, updatedLoans };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const nowUTC = new Date();
    const etOffset = isDST(nowUTC) ? -4 : -5;
    const etNow = new Date(nowUTC.getTime() + etOffset * 3600 * 1000);
    const today = etNow.toISOString().split('T')[0];

    if (!isMarketDay(today)) {
      return jsonResponse({ skipped: true, reason: 'Not a market day', date: today });
    }

    const res = await fetch(LIVE_URL);
    if (!res.ok) return jsonResponse({ error: `Live price fetch failed: ${res.status}`, tspDown: true }, 200);
    const rows = await res.json();

    const fundData = {};
    for (const row of rows) {
      const key = DISPLAY_TO_KEY[row['Fund']];
      if (!key) continue;
      const price = parseFloat(row['Price']);
      if (!price || isNaN(price)) continue;
      fundData[key] = {
        share_price: price,
        daily_change_percent: parsePercent(row['Day %']),
        wtd_return_percent: parsePercent(row['Week %']),
        mtd_return_percent: parsePercent(row['Month %']),
        ytd_return_percent: parsePercent(row['Year %']),
      };
    }

    if (Object.keys(fundData).length === 0) {
      return jsonResponse({ error: 'No fund data parsed from live sheet', tspDown: true }, 200);
    }

    const { data: allProfiles } = await adminClient.from('tsp_profiles').select('*');
    const results = [];

    for (const profile of (allProfiles || [])) {
      try {
        const { data: allocations } = await adminClient.from('fund_allocations').select('*').eq('profile_id', profile.id);
        const selectedFunds = (allocations || []).filter(f => f.is_selected);

        if (selectedFunds.length === 0) {
          results.push({ profile_id: profile.id, skipped: true, reason: 'No selected funds' });
          continue;
        }

        const mfwBal = profile.has_mfw && profile.mfw_balance ? profile.mfw_balance : 0;
        const totalManual = profile.total_balance_manual || 0;

        // Re-valuing from unit counts (below) makes the price half of this job
        // idempotent — running it twice for the same market day lands on exactly
        // the same balance. Contributions are the part that isn't: they buy new
        // units and advance loan.repaid, so a second run for a day we've already
        // processed would double-count them. This job is the only writer that
        // INSERTS a daily_balances row (mfwPriceUpdate only adjusts one that's
        // already there), so a row for `today` is an exact record of having run.
        const { data: existingBal } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', today);
        const alreadyProcessedToday = !!(existingBal && existingBal.length > 0);
        const todayIsPayDay = isPayDay(etNow, profile.pay_schedule || 'biweekly', profile.pay_date_anchor);
        const applyContributions = todayIsPayDay && !alreadyProcessedToday;
        const loanResult = applyContributions ? calcLoanRepayments(profile) : { total: 0, updatedLoans: profile.loans };
        const loanRepaymentAmount = loanResult.total;
        const contributionAmount = (applyContributions ? calcPayPeriodContribution(profile) : 0) + loanRepaymentAmount;

        // Fallback weighting for distributing today's contribution across funds
        // when allocation_percent isn't set (dollar-entry profiles, or a selected
        // fund sitting at 0%) — split by current balance share instead.
        const fundsCurrentTotal = selectedFunds.reduce((s, f) => s + (f.balance || f.dollar_balance || 0), 0);

        // allocation_percent is only ever used to decide where NEW contribution
        // money goes on a pay day — never to redistribute the existing balance.
        // Normalize in case percentages don't sum to 100 (e.g. 74/5/5), so a
        // pay-day contribution still lands fully invested instead of partly
        // discarded.
        const allocPctSum = selectedFunds.reduce((s, f) => s + (f.allocation_percent || 0), 0);
        const allocScale = allocPctSum > 0 ? 100 / allocPctSum : 0;

        let newTotalBalance = 0;

        for (const fund of selectedFunds) {
          const data = fundData[fund.fund_name];
          if (!data) continue;

          const newPrice = data.share_price;
          // The price the stored balance is currently valued at. Every writer of
          // fund_allocations (this job, rebalanceFundAllocations, the allocation
          // editor) keeps balance === shares x share_price, so share_price is
          // always the price that stored balance was struck at.
          const storedPrice = fund.share_price > 0 ? fund.share_price : 0;
          const prevPrice = storedPrice || newPrice;
          // Derive the day's move from the two actual prices rather than the
          // sheet's "Day %" column. That column is rounded to two decimals
          // (-0.86, 0.23, -1.17), and it is published independently of the price
          // — so it can lag or lead the Price column by a day. Either way it
          // disagrees with the prices we're storing, and the disagreement used
          // to be baked permanently into the balance. Only fall back to it when
          // there's no prior price to measure against.
          const dailyReturn = storedPrice > 0
            ? ((newPrice - storedPrice) / storedPrice) * 100
            : (data.daily_change_percent ?? 0);
          const jan1Price = (fund.jan1_share_price && fund.jan1_share_price > 0) ? fund.jan1_share_price : (JAN1_PRICES[fund.fund_name] || newPrice);
          const ytdReturn = jan1Price > 0 ? ((newPrice - jan1Price) / jan1Price) * 100 : 0;

          // A real TSP account holds UNITS of each fund. The dollar balance is
          // just those units priced at today's close — it is not a running total
          // that gets nudged by a percentage each night. Re-valuing from units is
          // what keeps this in step with tsp.gov:
          //   - a stale price sheet is a no-op instead of re-applying yesterday's
          //     return to today,
          //   - a second run for the same day reproduces the same number,
          //   - two-decimal rounding in the sheet can't accumulate.
          // Compounding `balance * (1 + dailyReturn/100)` did none of that: every
          // error it made was permanent, because nothing ever re-derived the
          // balance from a price again.
          //
          // Units must never be reset to allocation% x total: allocation% only
          // says where NEW money goes, and resetting discards the real drift
          // between funds (confirmed against a real TSP statement — two funds
          // sharing an allocation% had been driven to an identical balance,
          // which real accounts never do).
          const currentBal = fund.balance || fund.dollar_balance || 0;
          let units = prevPrice > 0 ? currentBal / prevPrice : 0;

          // Buy units with today's contribution at today's price, split by
          // allocation % (falling back to current-balance weighting when
          // allocation % isn't meaningful — dollar-entry profiles, or a
          // 0%-allocated selected fund).
          if (contributionAmount > 0 && newPrice > 0) {
            const allocPct = ((fund.allocation_percent || 0) * allocScale) / 100;
            const fundShare = allocPct > 0
              ? allocPct
              : (fundsCurrentTotal > 0 ? currentBal / fundsCurrentTotal : 1 / selectedFunds.length);
            units += (contributionAmount * fundShare) / newPrice;
          }

          const newBalance = units * newPrice;
          newTotalBalance += newBalance;

          await adminClient.from('fund_allocations').update({
            share_price: newPrice,
            previous_share_price: prevPrice,
            jan1_share_price: jan1Price,
            balance: newBalance,
            dollar_balance: newBalance,
            // Persist the unit count this balance was struck from. Leaving it
            // stale is what made `shares` a derived afterthought rather than the
            // holding it represents.
            shares: units,
            return_percent: ytdReturn,
            daily_return_percent: dailyReturn,
            wtd_return_percent: data.wtd_return_percent ?? fund.wtd_return_percent ?? 0,
            mtd_return_percent: data.mtd_return_percent ?? fund.mtd_return_percent ?? 0,
            last_price_update: today,
          }).eq('id', fund.id);
        }

        newTotalBalance += mfwBal;

        // Safety net: a single day's market move can't plausibly change the
        // balance by a third in either direction. If the newly derived total is
        // wildly off the stored one, treat it as a computation fault rather than
        // a real move — bail before writing it anywhere, so a bad derivation
        // can't wreck the balance or the history, and can't feed off its own bad
        // output the next night. This has to catch overstatement too: guarding
        // only the downside let the balance drift upward, away from tsp.gov,
        // with nothing to stop it.
        if (totalManual > 0 && (newTotalBalance < totalManual * 0.67 || newTotalBalance > totalManual * 1.33)) {
          results.push({
            profile_id: profile.id,
            skipped: true,
            reason: `Refused implausible balance move: ${totalManual} -> ${newTotalBalance}`,
          });
          continue;
        }

        const yesterday = new Date(etNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const { data: prevBals } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', yesterdayStr);
        const prevBal = (prevBals && prevBals.length > 0) ? prevBals[0].balance : (totalManual || newTotalBalance);
        const dailyChange = newTotalBalance - prevBal;
        const dailyChangePct = prevBal > 0 ? (dailyChange / prevBal) * 100 : 0;

        const balRecord = {
          created_by_id: profile.created_by_id,
          profile_id: profile.id, date: today, balance: newTotalBalance,
          daily_change: dailyChange, daily_change_percent: dailyChangePct,
          is_gain: dailyChange >= 0,
        };
        if (existingBal && existingBal.length > 0) {
          await adminClient.from('daily_balances').update(balRecord).eq('id', existingBal[0].id);
        } else {
          await adminClient.from('daily_balances').insert(balRecord);
        }

        const profileUpdates = { total_balance_manual: newTotalBalance, balance_last_confirmed: today };
        if (loanRepaymentAmount > 0) {
          profileUpdates.loans = loanResult.updatedLoans;
        }
        if (newTotalBalance > (profile.highest_balance || 0)) {
          profileUpdates.highest_balance = newTotalBalance;
          profileUpdates.highest_balance_date = today;
        }
        await adminClient.from('tsp_profiles').update(profileUpdates).eq('id', profile.id);

        results.push({ profile_id: profile.id, success: true, newTotalBalance, dailyChange, contributionAmount, loanRepaymentAmount });
      } catch (e) {
        results.push({ profile_id: profile.id, error: e.message });
      }
    }

    return jsonResponse({
      success: true,
      date: today,
      profilesUpdated: results.filter(r => r.success).length,
      results,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

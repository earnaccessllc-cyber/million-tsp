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

// The sheet stamps its own refresh time in a "Last Updated" column (only
// populated on some rows), formatted like "8/21/2026, 8:49:21 PM". Returns it
// as YYYY-MM-DD so it can be checked against the day we're about to record.
function parseSheetDate(rows) {
  for (const row of rows) {
    const raw = row['Last Updated'];
    if (!raw) continue;
    const m = String(raw).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) continue;
    const [, mo, d, y] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

function parsePercent(str) {
  if (!str) return null;
  const clean = String(str).replace(/[+%\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

const PAY_PERIODS = { biweekly: 26, monthly: 12 };

// The most recent pay date on or before `dateStr`.
//
// This used to ask "is today a pay day", which isn't enough on its own: a pay
// date can land on a weekend or a market holiday, and this job only runs on
// market days, so a period whose pay date fell on one would be skipped
// entirely and its deposit lost. Asking which pay period we are in instead
// lets the first market day after the pay date pick it up.
//
// Period boundaries mirror src/lib/contributionCalc.js's getPeriodsElapsed, so
// they line up with the YTD math the rest of the app already does: 14-day
// blocks for biweekly, calendar months for monthly. A profile with a real known
// pay date (pay_date_anchor) anchors the biweekly cycle to that instead —
// agencies' actual pay calendars don't line up with a generic Jan-1 grid.
function lastPayDateOnOrBefore(dateStr, paySchedule, anchorDateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));

  if (paySchedule === 'biweekly' && anchorDateStr) {
    const [ay, am, ad] = String(anchorDateStr).split('-').map(Number);
    const anchor = new Date(Date.UTC(ay, am - 1, ad));
    const diffDays = Math.floor((cur - anchor) / 86400000);
    if (diffDays < 0) return null;
    cur.setUTCDate(cur.getUTCDate() - (((diffDays % 14) + 14) % 14));
    return cur.toISOString().split('T')[0];
  }

  if (paySchedule === 'monthly') return `${y}-${String(m).padStart(2, '0')}-01`;

  // Biweekly with no anchor: 14-day blocks from Jan 1.
  const jan1 = new Date(Date.UTC(y, 0, 1));
  const dayOfYear = Math.floor((cur - jan1) / 86400000);
  jan1.setUTCDate(jan1.getUTCDate() + Math.floor(dayOfYear / 14) * 14);
  return jan1.toISOString().split('T')[0];
}

// TSP posts a deposit some business days after the pay date. Walking forward
// over market days (rather than adding calendar days) means the result is
// always a day this job actually runs, so a posting date can't land somewhere
// nothing will pick it up.
function addBusinessDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  let added = 0;
  while (added < n) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (isMarketDay(cur.toISOString().split('T')[0])) added++;
  }
  return cur.toISOString().split('T')[0];
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

    // Refuse to record prices that aren't actually for the day we're recording.
    // TSP posts closing prices in the evening and this sheet picks them up
    // around 8:50pm ET, so a job running too early (or served a cached copy)
    // reads the PREVIOUS market day's prices — which is exactly what happened:
    // the account sat a full market day behind tsp.gov, with each night's run
    // writing yesterday's price under today's date. Bailing out here leaves the
    // day unprocessed so a later run can do it properly with real data, rather
    // than banking stale prices and marking the day done.
    const sheetDate = parseSheetDate(rows);
    if (sheetDate && sheetDate !== today) {
      return jsonResponse({
        skipped: true,
        reason: `Price sheet is dated ${sheetDate}, not ${today} — refusing to record stale prices`,
        date: today,
        sheetDate,
      });
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
        // the same balance. Deposits are idempotent by a different route: each
        // one is a pending_contributions row, unique per pay date and marked
        // posted once credited, so a re-run finds nothing due rather than buying
        // the same units twice. This job is the only writer that INSERTS a
        // daily_balances row (mfwPriceUpdate only adjusts one that's already
        // there), so a row for `today` is an exact record of having run.
        const { data: existingBal } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', today);
        const alreadyProcessedToday = !!(existingBal && existingBal.length > 0);

        // This job is polled every couple of minutes around the sheet's publish
        // time so the balance moves as soon as the price does. Once a day has
        // been processed at the prices currently on the sheet there is nothing
        // left to do, so bail before touching anything — otherwise every poll
        // for the rest of the window rewrites all the same numbers and churns
        // updated_date. A price that moves again later still gets picked up,
        // because this only short-circuits while the stored prices already
        // match the sheet exactly.
        const pricesAlreadyStored = selectedFunds.every(f => {
          const d = fundData[f.fund_name];
          return !d || Number(f.share_price) === Number(d.share_price);
        });
        if (alreadyProcessedToday && pricesAlreadyStored) {
          results.push({ profile_id: profile.id, skipped: true, reason: 'Already priced for today at these prices' });
          continue;
        }

        // Payroll takes the money on the pay date; TSP posts it to the account
        // a few business days later, and buys units at the price on the day it
        // posts. This job used to credit it on the pay date, which got both
        // halves wrong: the balance ran ahead of tsp.gov until TSP caught up
        // (measured 2026-08-27: $330.07 ahead, against contributions plus match
        // of $330.10, snapping back when TSP posted), and the units were struck
        // at the wrong day's price.
        //
        // So a pay date now enqueues the deposit with the day it is expected to
        // land, and the money is credited on or after that day instead. A queue
        // rather than a "was there a pay day N days ago" test, because a row
        // that stays unposted until it is actually credited cannot be silently
        // dropped by a run that didn't happen, and can be read back when a
        // number looks wrong.
        const payDate = lastPayDateOnOrBefore(today, profile.pay_schedule || 'biweekly', profile.pay_date_anchor);

        // The queue row is also the record of "payroll for this period has been
        // accounted for" — one per profile per pay date, enforced by a unique
        // constraint, so polling every couple of minutes can't process a period
        // twice.
        let payPeriodRow = null;
        if (payDate) {
          const { data: existingPay } = await adminClient
            .from('pending_contributions')
            .select('*')
            .eq('profile_id', profile.id)
            .eq('pay_date', payDate)
            .limit(1);
          payPeriodRow = (existingPay && existingPay.length > 0) ? existingPay[0] : null;
        }
        const payPeriodIsNew = !!payDate && !payPeriodRow;

        // Loan repayment tracking advances when payroll takes the money, not
        // when TSP posts it and not only when crediting is switched on. How much
        // of a loan has come out of your pay is a fact about payroll; when the
        // deposit reaches the account is a separate question, and only the
        // second one is in doubt.
        const loanResult = payPeriodIsNew ? calcLoanRepayments(profile) : { total: 0, updatedLoans: profile.loans };

        if (payPeriodIsNew) {
          const lagDays = Math.min(30, Math.max(0, Math.round(Number(profile.contribution_posting_lag_days ?? 3)) || 0));
          // Amounts are struck from the profile as it stands on the pay date,
          // not as it stands when the deposit posts, so a salary or contribution
          // change while money is in flight can't retroactively rewrite what
          // payroll already took.
          const { error: enqueueError } = await adminClient.from('pending_contributions').upsert({
            created_by_id: profile.created_by_id,
            profile_id: profile.id,
            pay_date: payDate,
            post_date: addBusinessDays(payDate, lagDays),
            contribution_amount: calcPayPeriodContribution(profile),
            loan_repayment_amount: loanResult.total,
          }, { onConflict: 'profile_id,pay_date', ignoreDuplicates: true });
          if (enqueueError) throw enqueueError;
        }

        // What the queue says has landed. `lte(post_date, today)` rather than an
        // equality test, so a deposit whose posting day this job missed is
        // picked up on the next run instead of stranded.
        //
        // contribution_credit_from is where the queue starts paying out: rows
        // are recorded for every pay period regardless, but only periods from
        // the day crediting was switched on are ever credited. Without it,
        // enabling this would immediately credit a period that a reconciled
        // balance already accounts for.
        const autoCredit = profile.auto_credit_contributions === true;
        const creditFrom = profile.contribution_credit_from || null;
        let duePending = [];
        if (autoCredit && creditFrom) {
          const { data: due } = await adminClient
            .from('pending_contributions')
            .select('*')
            .eq('profile_id', profile.id)
            .is('posted_at', null)
            .gte('pay_date', creditFrom)
            .lte('post_date', today);
          duePending = due || [];
        }
        const loanRepaymentAmount = duePending.reduce((sum, r) => sum + (Number(r.loan_repayment_amount) || 0), 0);
        const contributionAmount = duePending.reduce((sum, r) => sum + (Number(r.contribution_amount) || 0), 0) + loanRepaymentAmount;

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

        // Mark the queue rows credited as soon as the units are bought, rather
        // than after the balance write below: the fund_allocations updates above
        // have already committed those units, so a bail-out further down must
        // not leave the same deposit sitting due for the next run.
        if (duePending.length > 0) {
          const postedAt = new Date().toISOString();
          await adminClient
            .from('pending_contributions')
            .update({ posted_on: today, posted_at: postedAt, updated_date: postedAt })
            .in('id', duePending.map((r) => r.id));
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

        // balance_last_confirmed is the market DAY these prices belong to;
        // balance_last_confirmed_at is the instant we actually wrote them. The
        // UI needs both — the day to label the figure, the instant to show a
        // real update time instead of a hardcoded one.
        const profileUpdates = {
          total_balance_manual: newTotalBalance,
          balance_last_confirmed: today,
          balance_last_confirmed_at: new Date().toISOString(),
        };
        // loanResult.total is what payroll took this pay period;
        // loanRepaymentAmount is what the queue paid into the balance today.
        // They are different days, so progress keys off the first: a loan is
        // paid down when the deduction leaves your check, not when TSP posts
        // the deposit.
        if (loanResult.total > 0) {
          profileUpdates.loans = loanResult.updatedLoans;
        }
        if (newTotalBalance > (profile.highest_balance || 0)) {
          profileUpdates.highest_balance = newTotalBalance;
          profileUpdates.highest_balance_date = today;
        }
        await adminClient.from('tsp_profiles').update(profileUpdates).eq('id', profile.id);

        results.push({
          profile_id: profile.id, success: true, newTotalBalance, dailyChange,
          contributionAmount, loanRepaymentAmount,
          creditedPayDates: duePending.map((r) => r.pay_date),
          enqueuedPayDate: payPeriodIsNew ? payDate : null,
        });
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

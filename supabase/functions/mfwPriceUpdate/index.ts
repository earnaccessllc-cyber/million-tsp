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

// Refreshes mutual-fund-window (MFW) holdings and rolls the result into the
// profile's total balance. Runs separately from dailyPriceUpdate (which only
// covers TSP funds) and later in the morning, because mutual funds post their
// official NAV well after TSP prices are available the night before — running
// this too early would just re-fetch yesterday's stale close.
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

async function fetchYahooQuote(ticker) {
  const symbol = String(ticker).trim().toUpperCase();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Ticker not found: ${symbol}`);

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const price = result?.meta?.regularMarketPrice;
  if (!price) throw new Error(`No price available for ${symbol}`);

  const timestamps = result?.timestamp || [];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const pairs = timestamps
    .map((t, i) => ({ t: t * 1000, c: closes[i] }))
    .filter((p) => p.c != null)
    .sort((a, b) => a.t - b.t);

  const findCloseBefore = (targetMs) => {
    let candidate = null;
    for (const p of pairs) {
      if (p.t <= targetMs) candidate = p.c; else break;
    }
    return candidate;
  };

  const pctChange = (fromPrice) => (fromPrice && fromPrice > 0) ? ((price - fromPrice) / fromPrice) * 100 : null;

  const now = Date.now();
  const prevClose = result?.meta?.chartPreviousClose ?? findCloseBefore(now - 24 * 3600 * 1000);
  const weekAgoClose = findCloseBefore(now - 7 * 24 * 3600 * 1000);
  const monthAgoClose = findCloseBefore(now - 30 * 24 * 3600 * 1000);
  const jan1Ms = new Date(new Date().getFullYear(), 0, 1).getTime();
  const jan1Close = findCloseBefore(jan1Ms) ?? pairs[0]?.c ?? null;

  return {
    price,
    daily_change_percent: pctChange(prevClose),
    week_change_percent: pctChange(weekAgoClose),
    month_change_percent: pctChange(monthAgoClose),
    ytd_change_percent: pctChange(jan1Close),
  };
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

    const { data: profiles } = await adminClient
      .from('tsp_profiles')
      .select('*')
      .eq('has_mfw', true);

    const results = [];

    for (const profile of (profiles || [])) {
      try {
        const holdings = Array.isArray(profile.mfw_holdings) ? profile.mfw_holdings : [];
        if (holdings.length === 0) {
          results.push({ profile_id: profile.id, skipped: true, reason: 'No MFW holdings' });
          continue;
        }

        const oldMfwBalance = profile.has_mfw && profile.mfw_balance ? profile.mfw_balance : 0;

        const updatedHoldings = [];
        for (const h of holdings) {
          if (!h.ticker || !(parseFloat(h.shares) > 0)) {
            updatedHoldings.push(h);
            continue;
          }
          try {
            const quote = await fetchYahooQuote(h.ticker);
            const shares = parseFloat(h.shares);
            updatedHoldings.push({
              ...h,
              last_price: quote.price,
              dollar_value: shares * quote.price,
              last_updated: today,
              daily_change_percent: quote.daily_change_percent,
              week_change_percent: quote.week_change_percent,
              month_change_percent: quote.month_change_percent,
              ytd_change_percent: quote.ytd_change_percent,
            });
          } catch (e) {
            // Leave this holding's stored value as-is if its ticker lookup fails
            // (e.g. delisted or rate-limited) rather than dropping it from the total.
            updatedHoldings.push({ ...h, error: e.message });
          }
        }

        const newMfwBalance = updatedHoldings.reduce((sum, h) => sum + (parseFloat(h.dollar_value) || 0), 0);

        const mfwDelta = newMfwBalance - oldMfwBalance;
        const newTotalBalance = (profile.total_balance_manual || 0) + mfwDelta;

        await adminClient.from('tsp_profiles').update({
          mfw_holdings: updatedHoldings,
          mfw_balance: newMfwBalance,
          mfw_last_updated: today,
          total_balance_manual: newTotalBalance,
          balance_last_confirmed: today,
        }).eq('id', profile.id);

        const { data: existingBal } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', today);
        if (existingBal && existingBal.length > 0) {
          const bal = existingBal[0];
          const newBal = bal.balance + mfwDelta;
          await adminClient.from('daily_balances').update({
            balance: newBal,
            daily_change: (bal.daily_change || 0) + mfwDelta,
            is_gain: ((bal.daily_change || 0) + mfwDelta) >= 0,
          }).eq('id', bal.id);
        }

        results.push({ profile_id: profile.id, success: true, oldMfwBalance, newMfwBalance, mfwDelta, newTotalBalance });
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

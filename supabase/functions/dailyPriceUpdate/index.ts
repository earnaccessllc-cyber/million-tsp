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

const DISPLAY_TO_KEY = {
  'G Fund': 'G', 'F Fund': 'F', 'C Fund': 'C', 'S Fund': 'S', 'I Fund': 'I',
  'L Income': 'L Income', 'L2030': 'L2030', 'L2035': 'L2035', 'L2040': 'L2040',
  'L2045': 'L2045', 'L2050': 'L2050', 'L2055': 'L2055', 'L2060': 'L2060',
  'L2065': 'L2065', 'L2070': 'L2070', 'L2075': 'L2075',
};

const JAN1_PRICES = {
  G: 19.5922, F: 20.8602, C: 109.7449, S: 101.6677, I: 56.0292,
  'L Income': 29.2952, L2030: 58.3022, L2035: 17.7506, L2040: 68.0819,
  L2045: 18.8435, L2050: 41.7575, L2055: 21.5591, L2060: 21.5566,
  L2065: 21.5541, L2070: 12.7748, L2075: 11.1588,
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
        const nonMfwTotal = Math.max(0, totalManual - mfwBal);

        let newTotalBalance = 0;

        for (const fund of selectedFunds) {
          const data = fundData[fund.fund_name];
          if (!data) continue;

          const newPrice = data.share_price;
          const prevPrice = fund.share_price || newPrice;
          const dailyReturn = data.daily_change_percent ?? (prevPrice > 0 ? ((newPrice - prevPrice) / prevPrice) * 100 : 0);
          const jan1Price = (fund.jan1_share_price && fund.jan1_share_price > 0) ? fund.jan1_share_price : (JAN1_PRICES[fund.fund_name] || newPrice);
          const ytdReturn = jan1Price > 0 ? ((newPrice - jan1Price) / jan1Price) * 100 : 0;

          let newBalance;

          if (profile.entry_method === 'dollar') {
            const currentBal = fund.dollar_balance || fund.balance || 0;
            newBalance = currentBal > 0 ? currentBal * (1 + dailyReturn / 100) : currentBal;
          } else {
            const allocPct = (fund.allocation_percent || 0) / 100;
            if (nonMfwTotal > 0 && allocPct > 0) {
              const baseBalance = nonMfwTotal * allocPct;
              newBalance = dailyReturn !== 0 ? baseBalance * (1 + dailyReturn / 100) : baseBalance;
            } else {
              const currentBal = fund.balance || fund.dollar_balance || 0;
              newBalance = currentBal > 0 && dailyReturn !== 0 ? currentBal * (1 + dailyReturn / 100) : currentBal;
            }
          }

          newTotalBalance += newBalance;

          await adminClient.from('fund_allocations').update({
            share_price: newPrice,
            previous_share_price: prevPrice,
            jan1_share_price: jan1Price,
            balance: newBalance,
            dollar_balance: newBalance,
            return_percent: ytdReturn,
            daily_return_percent: dailyReturn,
            wtd_return_percent: data.wtd_return_percent ?? fund.wtd_return_percent ?? 0,
            mtd_return_percent: data.mtd_return_percent ?? fund.mtd_return_percent ?? 0,
            last_price_update: today,
          }).eq('id', fund.id);
        }

        newTotalBalance += mfwBal;

        const yesterday = new Date(etNow);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const { data: prevBals } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', yesterdayStr);
        const prevBal = (prevBals && prevBals.length > 0) ? prevBals[0].balance : (totalManual || newTotalBalance);
        const dailyChange = newTotalBalance - prevBal;
        const dailyChangePct = prevBal > 0 ? (dailyChange / prevBal) * 100 : 0;

        const { data: existingBal } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile.id).eq('date', today);
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
        if (newTotalBalance > (profile.highest_balance || 0)) {
          profileUpdates.highest_balance = newTotalBalance;
          profileUpdates.highest_balance_date = today;
        }
        await adminClient.from('tsp_profiles').update(profileUpdates).eq('id', profile.id);

        results.push({ profile_id: profile.id, success: true, newTotalBalance, dailyChange });
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

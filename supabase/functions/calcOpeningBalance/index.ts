import { jsonResponse, handleOptions } from '../_shared/cors.ts';
import { getClients, getUser, ownsOrAdmin } from '../_shared/auth.ts';

// Calculates a profile's Jan 1 opening balance from TSP.gov historical share prices.
// Uses the user's current shares x the first trading day of the current year (or Dec 31 prior year) share price.
// Optionally pass profile_id + fund allocations to compute before a profile is fully saved.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const { profile_id, funds: inlineFunds } = body;

    let profile = null;
    if (profile_id) {
      const { data } = await adminClient.from('tsp_profiles').select('*').eq('id', profile_id).maybeSingle();
      profile = data;
      if (!profile) return jsonResponse({ error: 'Profile not found' }, 404);
      if (!ownsOrAdmin(profile, user)) return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const csvUrl = 'https://www.tsp.gov/fund-performance/share-price-history.csv';
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      return jsonResponse({ error: 'Could not fetch TSP data', status: csvResponse.status }, 502);
    }

    const csvText = await csvResponse.text();
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return jsonResponse({ error: 'No data in CSV' }, 502);
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    const getPrice = (row, fundName) => {
      if (!row) return null;
      let idx = headers.findIndex(h => h.trim() === fundName);
      if (idx < 0) idx = headers.findIndex(h => h.includes(fundName));
      if (idx < 0 || !row[idx]) return null;
      const p = parseFloat(row[idx]);
      return isNaN(p) ? null : p;
    };

    const parseRow = (line) => line.split(',').map(v => v.trim().replace(/"/g, ''));

    let jan1Row = null;
    for (let i = 1; i < lines.length; i++) {
      const row = parseRow(lines[i]);
      const d = new Date(row[0]);
      if (!isNaN(d) && d.getFullYear() === currentYear) { jan1Row = row; break; }
    }

    let dec31Row = null;
    for (let i = lines.length - 1; i >= 1; i--) {
      const row = parseRow(lines[i]);
      const d = new Date(row[0]);
      if (!isNaN(d) && d.getFullYear() === prevYear) { dec31Row = row; break; }
    }

    const baselineRow = jan1Row || dec31Row;
    const actualBaselineDate = baselineRow
      ? baselineRow[0]
      : new Date(currentYear, 0, 1).toISOString().split('T')[0];

    if (!baselineRow) {
      return jsonResponse({ error: 'Could not find Jan 1 share prices in TSP.gov data' }, 404);
    }

    let funds = inlineFunds || [];
    if (!funds.length && profile_id) {
      const { data } = await adminClient.from('fund_allocations').select('*').eq('profile_id', profile_id).eq('is_selected', true);
      funds = data || [];
    }

    if (!funds.length) {
      return jsonResponse({ error: 'No funds provided', jan1_prices: {}, opening_balance: null }, 200);
    }

    const jan1Prices = {};
    const fundBreakdown = [];
    let totalOpeningBalance = 0;

    for (const fund of funds) {
      const fundName = fund.fund_name;
      const shares = fund.shares || 0;
      const jan1Price = getPrice(baselineRow, fundName);

      if (jan1Price !== null) {
        jan1Prices[fundName] = jan1Price;
        const fundBalance = shares * jan1Price;
        totalOpeningBalance += fundBalance;
        fundBreakdown.push({ fund_name: fundName, shares, jan1_price: jan1Price, jan1_balance: fundBalance });
      }
    }

    if (profile_id && fundBreakdown.length > 0) {
      await adminClient.from('tsp_profiles').update({ opening_balance: totalOpeningBalance }).eq('id', profile_id);

      const { data: allFunds } = await adminClient.from('fund_allocations').select('*').eq('profile_id', profile_id);
      for (const fund of (allFunds || [])) {
        if (jan1Prices[fund.fund_name] !== undefined) {
          await adminClient.from('fund_allocations').update({ jan1_share_price: jan1Prices[fund.fund_name] }).eq('id', fund.id);
        }
      }

      const { data: existing } = await adminClient.from('annual_performances').select('*').eq('profile_id', profile_id).eq('year', currentYear);
      if (!existing || existing.length === 0) {
        await adminClient.from('annual_performances').insert({
          created_by_id: profile.created_by_id,
          profile_id, year: currentYear, opening_balance: totalOpeningBalance, is_complete: false,
        });
      } else if (!existing[0].opening_balance || existing[0].opening_balance === 0) {
        await adminClient.from('annual_performances').update({ opening_balance: totalOpeningBalance }).eq('id', existing[0].id);
      }
    }

    return jsonResponse({
      success: true,
      baseline_date: actualBaselineDate,
      opening_balance: totalOpeningBalance,
      jan1_prices: jan1Prices,
      fund_breakdown: fundBreakdown,
      source: 'tsp.gov historical CSV',
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

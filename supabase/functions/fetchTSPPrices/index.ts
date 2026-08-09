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

function handleOptions(req) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

function getClients(req) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  return { userClient, adminClient };
}

async function getUser(userClient, adminClient) {
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  return { id: user.id, email: user.email, role: roleRow?.role || 'user' };
}

function ownsOrAdmin(profile, user) {
  return !!(user && profile && (profile.created_by_id === user.id || user.role === 'admin'));
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { profile_id, csv_data } = await req.json();
    if (!profile_id) return jsonResponse({ error: 'profile_id required' }, 400);
    if (!csv_data) return jsonResponse({ error: 'csv_data required', tspDown: true }, 400);

    const csvText = csv_data;
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return jsonResponse({ error: 'No data in CSV' }, 502);

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const lastLine = lines[lines.length - 1];
    const values = lastLine.split(',').map(v => v.trim().replace(/"/g, ''));
    const dateStr = values[0];
    const today = new Date(dateStr);
    const currentYear = today.getFullYear();
    const today2 = new Date().toISOString().split('T')[0];

    const findRowBefore = (conditionFn) => {
      for (let i = lines.length - 2; i >= 1; i--) {
        const rowVals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const rowDate = new Date(rowVals[0]);
        if (!isNaN(rowDate) && conditionFn(rowDate, rowVals)) return rowVals;
      }
      return null;
    };

    let jan1Values = null;
    for (let i = 1; i < lines.length; i++) {
      const rowVals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const rowDate = new Date(rowVals[0]);
      if (!isNaN(rowDate) && rowDate.getFullYear() === currentYear) { jan1Values = rowVals; break; }
    }

    const dayOfWeek = today.getDay();
    const daysToLastFriday = dayOfWeek === 0 ? 2 : dayOfWeek === 6 ? 1 : dayOfWeek + 2;
    const lastFridayDate = new Date(today);
    lastFridayDate.setDate(today.getDate() - daysToLastFriday);

    const wtdValues = findRowBefore((d) => d <= lastFridayDate);
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const mtdValues = findRowBefore((d) => d < firstOfMonth);
    const prevDayValues = findRowBefore((d, row) => row[0] !== dateStr && d < today);

    const fundMapping = {
      'G Fund': 'G Fund', 'F Fund': 'F Fund', 'C Fund': 'C Fund',
      'S Fund': 'S Fund', 'I Fund': 'I Fund', 'L Income': 'L Income',
      'L 2025': 'L 2025', 'L 2030': 'L 2030', 'L 2035': 'L 2035',
      'L 2040': 'L 2040', 'L 2045': 'L 2045', 'L 2050': 'L 2050',
      'L 2055': 'L 2055', 'L 2060': 'L 2060', 'L 2065': 'L 2065',
      'L 2070': 'L 2070', 'L 2075': 'L 2075',
    };

    const headerIndex = {};
    headers.forEach((h, i) => {
      headerIndex[h.replace(/\s+/g, ' ').trim()] = i;
    });

    const getPrice = (row, fundName) => {
      if (!row) return null;
      let idx = headerIndex[fundName];
      if (idx === undefined) {
        idx = headers.findIndex(h => h.replace(/\s+/g, ' ').trim().toLowerCase() === fundName.toLowerCase());
      }
      if (idx === undefined || idx < 0 || !row[idx]) return null;
      const p = parseFloat(row[idx]);
      return isNaN(p) ? null : p;
    };

    const prices = {}, jan1Prices = {}, wtdPrices = {}, mtdPrices = {}, prevPrices = {};
    for (const [fundName, csvName] of Object.entries(fundMapping)) {
      const cur = getPrice(values, csvName); if (cur !== null) prices[fundName] = cur;
      const j1 = getPrice(jan1Values, csvName); if (j1 !== null) jan1Prices[fundName] = j1;
      const wtd = getPrice(wtdValues, csvName); if (wtd !== null) wtdPrices[fundName] = wtd;
      const mtd = getPrice(mtdValues, csvName); if (mtd !== null) mtdPrices[fundName] = mtd;
      const prev = getPrice(prevDayValues, csvName); if (prev !== null) prevPrices[fundName] = prev;
    }

    const { data: profile } = await adminClient.from('tsp_profiles').select('*').eq('id', profile_id).maybeSingle();
    if (!profile) return jsonResponse({ error: 'Profile not found' }, 404);
    if (!ownsOrAdmin(profile, user)) return jsonResponse({ error: 'Forbidden' }, 403);

    const { data: funds } = await adminClient.from('fund_allocations').select('*').eq('profile_id', profile_id);

    const mfwBal = (profile.has_mfw && profile.mfw_balance) ? profile.mfw_balance : 0;
    const totalManual = profile.total_balance_manual || 0;
    const nonMfwTotal = Math.max(0, totalManual - mfwBal);

    let totalBalance = 0;
    const updates = [];

    for (const fund of (funds || [])) {
      if (!fund.is_selected || prices[fund.fund_name] === undefined) continue;

      const newPrice = prices[fund.fund_name];
      const prevPrice = prevPrices[fund.fund_name] || fund.share_price || newPrice;
      const jan1Price = (fund.jan1_share_price && fund.jan1_share_price > 0)
        ? fund.jan1_share_price
        : (jan1Prices[fund.fund_name] || newPrice);
      const wtdPrice = wtdPrices[fund.fund_name] || fund.wtd_share_price || newPrice;
      const mtdPrice = mtdPrices[fund.fund_name] || fund.mtd_share_price || newPrice;

      const ytdReturn = jan1Price > 0 ? ((newPrice - jan1Price) / jan1Price) * 100 : 0;
      const dailyReturn = prevPrice > 0 ? ((newPrice - prevPrice) / prevPrice) * 100 : 0;
      const wtdReturn = wtdPrice > 0 ? ((newPrice - wtdPrice) / wtdPrice) * 100 : 0;
      const mtdReturn = mtdPrice > 0 ? ((newPrice - mtdPrice) / mtdPrice) * 100 : 0;

      const allocPct = (fund.allocation_percent || 0) / 100;
      let newBalance;
      if (nonMfwTotal > 0 && allocPct > 0) {
        const baseBalance = nonMfwTotal * allocPct;
        newBalance = dailyReturn !== 0 ? baseBalance * (1 + dailyReturn / 100) : baseBalance;
      } else {
        const currentBal = fund.balance || fund.dollar_balance || 0;
        newBalance = currentBal > 0 && dailyReturn !== 0 ? currentBal * (1 + dailyReturn / 100) : currentBal;
      }

      const newShares = newPrice > 0 ? newBalance / newPrice : (fund.shares || 0);

      totalBalance += newBalance;

      await adminClient.from('fund_allocations').update({
        share_price: newPrice,
        previous_share_price: prevPrice,
        jan1_share_price: jan1Price,
        wtd_share_price: wtdPrice,
        mtd_share_price: mtdPrice,
        balance: newBalance,
        dollar_balance: newBalance,
        shares: newShares,
        return_percent: ytdReturn,
        daily_return_percent: dailyReturn,
        wtd_return_percent: wtdReturn,
        mtd_return_percent: mtdReturn,
        last_price_update: dateStr,
      }).eq('id', fund.id);

      updates.push({ fund: fund.fund_name, price: newPrice, shares: newShares, balance: newBalance, ytdReturn, dailyReturn });

      const { data: prevFundSnaps } = await adminClient.from('fund_daily_snapshots').select('*').eq('profile_id', profile_id).eq('fund_name', fund.fund_name).eq('date', today2);
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const { data: prevFundSnaps2 } = await adminClient.from('fund_daily_snapshots').select('*').eq('profile_id', profile_id).eq('fund_name', fund.fund_name).eq('date', yesterdayStr);
      const prevFundBalance = (prevFundSnaps2 && prevFundSnaps2.length > 0) ? prevFundSnaps2[0].balance : newBalance;

      const snapRecord = {
        created_by_id: profile.created_by_id,
        profile_id, fund_name: fund.fund_name, date: today2,
        share_price: newPrice, shares: newShares, balance: newBalance,
        daily_change_dollars: newBalance - prevFundBalance,
        daily_change_percent: dailyReturn, wtd_percent: wtdReturn,
        mtd_percent: mtdReturn, ytd_percent: ytdReturn, portfolio_weight: 0,
      };
      if (prevFundSnaps && prevFundSnaps.length > 0) {
        await adminClient.from('fund_daily_snapshots').update(snapRecord).eq('id', prevFundSnaps[0].id);
      } else {
        await adminClient.from('fund_daily_snapshots').insert(snapRecord);
      }
    }

    const mfwTotal = (profile.has_mfw && profile.mfw_balance) ? profile.mfw_balance : 0;
    totalBalance += mfwTotal;

    if (totalBalance > 0) {
      const { data: todaySnaps } = await adminClient.from('fund_daily_snapshots').select('*').eq('profile_id', profile_id).eq('date', today2);
      for (const snap of (todaySnaps || [])) {
        await adminClient.from('fund_daily_snapshots').update({ portfolio_weight: (snap.balance / totalBalance) * 100 }).eq('id', snap.id);
      }
    }

    const { data: existingBalances } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile_id).eq('date', today2);
    const yesterday2 = new Date(); yesterday2.setDate(yesterday2.getDate() - 1);
    const yesterdayStr2 = yesterday2.toISOString().split('T')[0];
    const { data: yesterdayBalances } = await adminClient.from('daily_balances').select('*').eq('profile_id', profile_id).eq('date', yesterdayStr2);
    const yesterdayBalance = (yesterdayBalances && yesterdayBalances.length > 0) ? yesterdayBalances[0].balance : totalBalance;
    const dailyChange = totalBalance - yesterdayBalance;
    const dailyChangePct = yesterdayBalance > 0 ? (dailyChange / yesterdayBalance) * 100 : 0;

    const balanceRecord = {
      created_by_id: profile.created_by_id,
      profile_id, date: today2, balance: totalBalance,
      daily_change: dailyChange, daily_change_percent: dailyChangePct,
      is_gain: dailyChange >= 0,
    };
    if (existingBalances && existingBalances.length > 0) {
      await adminClient.from('daily_balances').update(balanceRecord).eq('id', existingBalances[0].id);
    } else {
      await adminClient.from('daily_balances').insert(balanceRecord);
    }

    const profileUpdates = {};
    if (totalBalance > (profile.highest_balance || 0)) {
      profileUpdates.highest_balance = totalBalance;
      profileUpdates.highest_balance_date = today2;
    }
    profileUpdates.total_balance_manual = totalBalance;

    if (Object.keys(profileUpdates).length > 0) {
      await adminClient.from('tsp_profiles').update(profileUpdates).eq('id', profile.id);
    }

    return jsonResponse({ success: true, date: dateStr, prices, updates, totalBalance, dailyChange });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

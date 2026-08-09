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

// Browsers can't call Yahoo Finance directly (no CORS headers on their API),
// so this proxies the lookup server-side for any user-entered ticker (MFW holdings).
// Fetches a full year of history so day/week/month/YTD % change can be computed,
// mirroring the Day%/Week%/Month%/YTD% columns shown for core TSP funds.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { ticker } = await req.json();
    if (!ticker) return jsonResponse({ error: 'ticker required' }, 400);

    const symbol = String(ticker).trim().toUpperCase();
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return jsonResponse({ error: `Ticker not found: ${symbol}` }, 404);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const price = result?.meta?.regularMarketPrice;
    if (!price) return jsonResponse({ error: `No price available for ${symbol}` }, 404);

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

    return jsonResponse({
      success: true,
      ticker: symbol,
      price,
      currency: result?.meta?.currency || null,
      name: result?.meta?.longName || result?.meta?.shortName || null,
      daily_change_percent: pctChange(prevClose),
      week_change_percent: pctChange(weekAgoClose),
      month_change_percent: pctChange(monthAgoClose),
      ytd_change_percent: pctChange(jan1Close),
      as_of: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

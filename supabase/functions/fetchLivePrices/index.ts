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

const LIVE_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/live%20prices';

const DISPLAY_TO_KEY = {
  'G Fund': 'G', 'F Fund': 'F', 'C Fund': 'C', 'S Fund': 'S', 'I Fund': 'I',
  'L Income': 'L Income', 'L2030': 'L2030', 'L2035': 'L2035', 'L2040': 'L2040',
  'L2045': 'L2045', 'L2050': 'L2050', 'L2055': 'L2055', 'L2060': 'L2060',
  'L2065': 'L2065', 'L2070': 'L2070', 'L2075': 'L2075',
};

function parsePercent(str) {
  if (!str) return null;
  const clean = String(str).replace(/[+%\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const res = await fetch(LIVE_URL);
    if (!res.ok) return jsonResponse({ error: `Fetch failed: ${res.status}` }, 503);

    const data = await res.json();
    const funds = {};

    for (const row of data) {
      const key = DISPLAY_TO_KEY[row['Fund']];
      if (!key) continue;
      funds[key] = {
        share_price: parseFloat(row['Price']) || null,
        daily_change: parseFloat(row['$ Change']) || 0,
        daily_change_percent: parsePercent(row['Day %']),
        wtd_return_percent: parsePercent(row['Week %']),
        mtd_return_percent: parsePercent(row['Month %']),
        ytd_return_percent: parsePercent(row['Year %']),
        last_updated: row['Last Updated'] || '',
      };
    }

    if (Object.keys(funds).length === 0) {
      return jsonResponse({ error: 'No fund data parsed' }, 422);
    }

    const prices = {};
    for (const [name, d] of Object.entries(funds)) {
      prices[name] = d.share_price;
    }

    return jsonResponse({ success: true, prices, funds, timestamp: new Date().toISOString() });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

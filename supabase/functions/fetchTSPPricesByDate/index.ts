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

const HISTORICAL_URL = 'https://opensheet.elk.sh/1ZAx2PyhwhaujcVdXNDMp6-BPUbmtJ1ixjkbtffDhES4/historical%20prices';

const FUND_KEYS = ['G', 'F', 'C', 'S', 'I', 'L2075', 'L2070', 'L2065', 'L2060', 'L2055', 'L2050', 'L2045', 'L2040', 'L2035', 'L2030', 'L Income'];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { userClient, adminClient } = getClients(req);
    const user = await getUser(userClient, adminClient);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { date } = await req.json();
    if (!date) return jsonResponse({ error: 'Missing date' }, 400);

    const res = await fetch(HISTORICAL_URL);
    if (!res.ok) return jsonResponse({ error: `Fetch failed: ${res.status}` }, 503);

    const rows = await res.json();
    if (!rows || rows.length === 0) return jsonResponse({ error: 'No historical data' }, 404);

    rows.sort((a, b) => a.Date.localeCompare(b.Date));

    let matchIdx = rows.findIndex(r => r.Date === date);
    let actualDate = date;

    if (matchIdx === -1) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i].Date <= date) { matchIdx = i; actualDate = rows[i].Date; break; }
      }
    }

    if (matchIdx === -1) {
      return jsonResponse({ error: 'No data found on or before requested date', date }, 404);
    }

    const row = rows[matchIdx];
    const prevRow = matchIdx > 0 ? rows[matchIdx - 1] : null;

    const prices = {};
    const changes = {};
    const changePcts = {};

    for (const fund of FUND_KEYS) {
      const price = parseFloat(row[fund]);
      if (!isNaN(price) && price > 0) {
        prices[fund] = price;
        const prev = prevRow ? parseFloat(prevRow[fund]) : null;
        if (prev && prev > 0) {
          changes[fund] = price - prev;
          changePcts[fund] = ((price - prev) / prev) * 100;
        } else {
          changes[fund] = 0;
          changePcts[fund] = 0;
        }
      }
    }

    return jsonResponse({ success: true, date: actualDate, requested_date: date, prices, changes, change_pcts: changePcts });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

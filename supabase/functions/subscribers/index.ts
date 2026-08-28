import { createClient } from 'jsr:@supabase/supabase-js@2';

// The canonical place to read the mailing list from.
//
// There is no subscriber table: a subscriber is a tsp_profiles row with the
// nightly-email flag on and an address set, and that has always been computed
// inline by nightlyEmailJob. This exposes the same set as a feed, so Resend (or
// anything else) has one definition to pull rather than each consumer
// re-deriving it and drifting.
//
// It serves PII, so it fails closed: without SUBSCRIBERS_API_KEY set in the
// project's secrets, and a matching x-api-key on the request, it returns
// nothing. verify_jwt is off because the caller is a server, not a logged-in
// user — this key check is the auth.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Quote a CSV field: double any quotes, and wrap when the value contains a
// delimiter, quote or newline. Also prefixes a leading =,+,-,@ so a spreadsheet
// can't interpret an address as a formula.
function csvField(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Compare in constant time so a wrong key can't be narrowed down by timing.
function keyMatches(presented, expected) {
  if (presented.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ presented.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const expectedKey = Deno.env.get('SUBSCRIBERS_API_KEY');
    if (!expectedKey) {
      return json({ error: 'SUBSCRIBERS_API_KEY is not configured; refusing to serve the list' }, 503);
    }

    const url = new URL(req.url);
    const presented = req.headers.get('x-api-key') || url.searchParams.get('key') || '';
    if (!keyMatches(presented, expectedKey)) return json({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // `all=true` returns unsubscribed rows too, marked, so a sync can suppress
    // them on the far side instead of just never seeing them again.
    const includeAll = url.searchParams.get('all') === 'true';

    let query = adminClient
      .from('tsp_profiles')
      .select('notif_email_address, name, plan, notif_nightly_email, notif_last_sent_date, created_date')
      .not('notif_email_address', 'is', null);
    if (!includeAll) query = query.eq('notif_nightly_email', true);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const rows = (data || [])
      .filter((r) => (r.notif_email_address || '').includes('@'))
      .map((r) => ({
        email: r.notif_email_address,
        first_name: r.name || '',
        plan: r.plan || 'free',
        subscribed: r.notif_nightly_email === true,
        last_sent: r.notif_last_sent_date || null,
        created_at: r.created_date || null,
      }));

    if ((url.searchParams.get('format') || '').toLowerCase() === 'csv') {
      const header = 'email,first_name,plan,subscribed,last_sent,created_at';
      const body = rows
        .map((r) => [r.email, r.first_name, r.plan, r.subscribed, r.last_sent, r.created_at].map(csvField).join(','))
        .join('\n');
      return new Response(`${header}\n${body}\n`, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="milliontsp-subscribers.csv"',
        },
      });
    }

    return json({ count: rows.length, subscribers: rows });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});

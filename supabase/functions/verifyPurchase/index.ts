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

// Server-side confirmation of a native (Apple) in-app purchase. The app logs
// into RevenueCat with the Supabase user id as the RevenueCat app_user_id
// (see identifyUser in src/lib/purchases.js), so this function never trusts
// anything the client sends: it takes the id from the verified JWT, asks
// RevenueCat's REST API whether that user holds the million_tsp_pro
// entitlement, and only then flips the profile to plan='paid' with the
// service role. Mirrors what stripeWebhook does for the web checkout.
//
// Requires either the REVENUECAT_SECRET_KEY secret (RevenueCat dashboard > API
// keys > secret key, "sk_...") or, as a fallback, REVENUECAT_PUBLIC_KEY (the
// app's public SDK key, "appl_..."), which can also read customer info.
// Once the app build that calls this function is live,
// migration 0012 blocks clients from setting plan='paid' themselves.
const ENTITLEMENT_ID = 'million_tsp_pro';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY') || Deno.env.get('REVENUECAT_PUBLIC_KEY');
    if (!rcKey) return jsonResponse({ error: 'REVENUECAT_SECRET_KEY / REVENUECAT_PUBLIC_KEY not configured' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const rcRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      { headers: { Authorization: `Bearer ${rcKey}`, 'Content-Type': 'application/json', 'X-Platform': 'ios' } },
    );
    if (!rcRes.ok) {
      console.error('verifyPurchase RevenueCat lookup failed', rcRes.status);
      return jsonResponse({ error: `RevenueCat lookup failed (${rcRes.status})` }, 502);
    }
    const { subscriber } = await rcRes.json();
    const ent = subscriber?.entitlements?.[ENTITLEMENT_ID];
    // A lifetime purchase has expires_date null; otherwise it must be in the future.
    const active = !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
    if (!active) return jsonResponse({ paid: false });

    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { error } = await adminClient
      .from('tsp_profiles')
      .update({ plan: 'paid', trial_start_date: null, trial_end_date: null })
      .eq('created_by_id', user.id);
    if (error) throw error;

    return jsonResponse({ paid: true });
  } catch (error) {
    console.error('verifyPurchase failed', error?.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

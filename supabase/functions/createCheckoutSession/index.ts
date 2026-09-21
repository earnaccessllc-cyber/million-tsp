import Stripe from 'npm:stripe@17.4.0';
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

// Creates a Stripe Checkout session for the one-time $19.99 lifetime-Pro
// unlock. Called from the browser (PaywallScreen / UpgradePrompt) with the
// signed-in user's session; the resulting Checkout URL is where we redirect
// them. client_reference_id carries the user id through to stripeWebhook,
// which is what actually flips the profile to plan='paid' once Stripe
// confirms payment — this function only ever starts the checkout, it never
// grants access itself.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Tracks which step we were on so a thrown error can be located in the logs.
  let stage = 'start';
  let keyPrefix = 'none';

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 200);
    // First 7 chars only (e.g. "sk_test" / "sk_live") — never the key itself.
    keyPrefix = stripeSecretKey.slice(0, 7);

    stage = 'auth';
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    // Managed Payments requires API version 2025-03-31.basil or newer.
    stage = 'stripe-init';
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-03-31.basil',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://milliontsp.com';

    // Uses Stripe Managed Payments (on by default for this account): Stripe is
    // the merchant of record and picks the payment methods, so no
    // payment_method_types here, and every line item needs an eligible product
    // tax code. txcd_10103000 = Software as a service - personal use. Change the
    // code if a different Managed Payments category fits the product better.
    stage = 'stripe-create-session';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'MillionTSP Pro — Lifetime Access',
            tax_code: 'txcd_10103000',
          },
          unit_amount: 1999,
        },
        quantity: 1,
      }],
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${origin}/settings?upgrade=success`,
      cancel_url: `${origin}/settings?upgrade=cancelled`,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession failed', JSON.stringify({
      stage,
      keyPrefix,
      name: error?.name,
      type: error?.type,
      code: error?.code,
      statusCode: error?.statusCode,
      message: error?.message,
    }));
    return jsonResponse({ error: error.message }, 500);
  }
});

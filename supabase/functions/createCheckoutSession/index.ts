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

// Creates a Stripe Checkout session for the one-time $14.99 lifetime-Pro
// unlock. Called from the browser (PaywallScreen / UpgradePrompt) with the
// signed-in user's session; the resulting Checkout URL is where we redirect
// them. client_reference_id carries the user id through to stripeWebhook,
// which is what actually flips the profile to plan='paid' once Stripe
// confirms payment — this function only ever starts the checkout, it never
// grants access itself.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY not configured' }, 200);

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://milliontsp.netlify.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'MillionTSP Pro — Lifetime Access' },
          unit_amount: 1499,
        },
        quantity: 1,
      }],
      client_reference_id: user.id,
      customer_email: user.email,
      success_url: `${origin}/Settings?upgrade=success`,
      cancel_url: `${origin}/Settings?upgrade=cancelled`,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

import Stripe from 'npm:stripe@17.4.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Stripe calls this directly (no Supabase auth header — it authenticates via
// the stripe-signature header instead), so this function must be deployed
// with verify_jwt disabled. It's the only place that actually grants Pro
// access: createCheckoutSession merely starts a purchase, this confirms one
// actually completed before touching the database.
Deno.serve(async (req) => {
  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeSecretKey || !webhookSecret) {
      return new Response(JSON.stringify({ error: 'Stripe secrets not configured' }), { status: 200 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-11-20.acacia' });
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
        undefined,
        Stripe.createSubtleCryptoProvider()
      );
    } catch (err) {
      return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      if (userId) {
        const adminClient = createClient(
          Deno.env.get('SUPABASE_URL'),
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        );
        await adminClient
          .from('tsp_profiles')
          .update({ plan: 'paid', trial_start_date: null, trial_end_date: null })
          .eq('created_by_id', userId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

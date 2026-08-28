import { createClient } from 'jsr:@supabase/supabase-js@2';

// One-click unsubscribe, reachable from inside a delivered email.
//
// The footer used to say "turn this off in your notification settings" — an
// instruction, not a mechanism. Once mail goes to paying customers rather than
// only the owner, CAN-SPAM requires an opt-out that works from the message
// itself, and mailbox providers weigh a List-Unsubscribe header when deciding
// whether to deliver at all.
//
// Auth is the token in the link: there is no session in an email client. The
// token identifies exactly one profile, can be rotated to invalidate old links,
// and grants nothing beyond turning nightly email off. verify_jwt is therefore
// off — a recipient clicking a link has no JWT to present.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function page(title, message, ok = true) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#08080a;color:#fff;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:420px;text-align:center;">
    <div style="font-size:40px;margin-bottom:12px;">${ok ? '&#10003;' : '&#9888;'}</div>
    <h1 style="font-size:20px;margin:0 0 8px;">${title}</h1>
    <p style="color:#9a9aa2;font-size:14px;line-height:1.5;margin:0;">${message}</p>
  </div>
</body></html>`,
    { status: ok ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token') || '';

    // RFC 8058 one-click: the mailbox provider POSTs the List-Unsubscribe-Post
    // body rather than following the link, so accept a form-encoded token too.
    if (!token && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = new URLSearchParams(await req.text());
        token = form.get('token') || '';
      }
    }

    if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
      return page('Invalid link', 'That unsubscribe link is malformed. You can turn nightly emails off any time in the app under Settings &rarr; Notifications.', false);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Match on the token alone: it is the credential. Returning the row tells
    // us whether it matched without a second round trip.
    const { data, error } = await adminClient
      .from('tsp_profiles')
      .update({ notif_nightly_email: false })
      .eq('unsubscribe_token', token)
      .select('notif_email_address');

    if (error) {
      return page('Something went wrong', 'We could not process that just now. Please try again, or turn nightly emails off in the app under Settings &rarr; Notifications.', false);
    }

    if (!data || data.length === 0) {
      // Already-unsubscribed and unknown tokens look the same on purpose: this
      // endpoint is public, so it must not confirm whether a token is real.
      return page('You are unsubscribed', 'You will not receive further nightly balance emails.');
    }

    return page(
      'You are unsubscribed',
      `Nightly balance emails are now off${data[0].notif_email_address ? ` for ${data[0].notif_email_address}` : ''}. You can turn them back on any time in the app under Settings &rarr; Notifications.`
    );
  } catch (_e) {
    return page('Something went wrong', 'We could not process that just now. Please try again, or turn nightly emails off in the app under Settings &rarr; Notifications.', false);
  }
});

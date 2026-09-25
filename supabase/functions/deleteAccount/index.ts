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

// Permanently deletes the signed-in user's auth account. Apple requires apps
// that support account creation to also let users delete the account itself
// from inside the app (App Store Review Guideline 5.1.1(v)) — clearing the
// user's data while leaving the login behind does not satisfy it.
//
// The user id comes only from the verified JWT, never the request body. Every
// user-owned table references auth.users(id) with ON DELETE CASCADE (see
// supabase/migrations), so deleting the auth user removes all of their
// profiles, balances, snapshots, notifications, etc. in the same step.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return jsonResponse({ deleted: true });
  } catch (error) {
    console.error('deleteAccount failed', error?.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

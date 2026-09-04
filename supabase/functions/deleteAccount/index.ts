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

// Permanently deletes the calling user's account (Settings → Danger Zone →
// "Delete Account"). This is the piece the client can't do on its own:
// removing a row from auth.users requires the service-role key, which never
// ships to the browser. Every user-data table (tsp_profiles, fund_allocations,
// daily_balances, etc.) has created_by_id/user_id set up with
// "references auth.users(id) on delete cascade" (see 0001_init.sql), so
// deleting the auth user here also wipes all of that user's data in one
// transaction — no separate per-table cleanup needed.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) return jsonResponse({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, 500);

    // Identify the caller from their own session token — never trust a
    // user id passed in the request body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) return jsonResponse({ error: deleteError.message }, 500);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
});

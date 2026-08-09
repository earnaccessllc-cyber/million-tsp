import { createClient } from 'jsr:@supabase/supabase-js@2';

// Two clients: `userClient` runs as the calling user (respects RLS) and is
// used to identify who's calling; `adminClient` uses the service_role key
// (bypasses RLS) — the direct equivalent of Base44's `base44.asServiceRole`.
export function getClients(req) {
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

// Returns { id, email, role } for the calling user, or null if unauthenticated.
export async function getUser(userClient, adminClient) {
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: roleRow } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  return { id: user.id, email: user.email, role: roleRow?.role || 'user' };
}

export function isAdmin(user) {
  return !!(user && user.role === 'admin');
}

// Mirrors base44/shared/auth.ts's ownsOrAdmin — profile.created_by_id vs user.id.
export function ownsOrAdmin(profile, user) {
  return !!(user && profile && (profile.created_by_id === user.id || user.role === 'admin'));
}

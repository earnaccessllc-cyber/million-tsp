import { createClient } from '@supabase/supabase-js';

// Drop-in replacement for src/api/base44Client.js. Exposes the same shape
// (auth.*, entities.X.list/filter/create/update/delete, functions.invoke)
// so existing components don't need to change how they call `base44` —
// only this file and the import path change.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — copy .env.example to .env and fill them in.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Base44 entity name -> Postgres table name (see supabase/migrations/0001_init.sql)
const TABLES = {
  TSPProfile: 'tsp_profiles',
  OpeningBalanceHistory: 'opening_balance_history',
  FundAllocation: 'fund_allocations',
  TSPHistoricalPrice: 'tsp_historical_prices',
  AppNotification: 'app_notifications',
  AnnualSummary: 'annual_summaries',
  AnnualPerformance: 'annual_performances',
  Beneficiary: 'beneficiaries',
  FundDailySnapshot: 'fund_daily_snapshots',
  DailyBalance: 'daily_balances',
};

function parseSort(sort) {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  return { column: desc ? sort.slice(1) : sort, ascending: !desc };
}

function makeEntity(table) {
  return {
    // list(sort?, limit?) — mirrors base44 `Entity.list('-updated_date')`
    async list(sort, limit) {
      let q = supabase.from(table).select('*');
      const s = parseSort(sort);
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    // filter(query, sort?, limit?) — query is a plain equality-match object,
    // e.g. { profile_id: id, date: today }, matching how this app calls it.
    async filter(query = {}, sort, limit) {
      let q = supabase.from(table).select('*').match(query);
      const s = parseSort(sort);
      if (s) q = q.order(s.column, { ascending: s.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    async create(record) {
      const { data, error } = await supabase.from(table).insert(record).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

const entities = Object.fromEntries(
  Object.entries(TABLES).map(([entityName, table]) => [entityName, makeEntity(table)])
);

async function getRole(userId) {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
  return data?.role || 'user';
}

const auth = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');
    const role = await getRole(user.id);
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      role,
    };
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { access_token: data.session?.access_token };
  },

  // Supabase-js persists the session itself once signInWithPassword resolves,
  // so there's nothing extra to store here — kept as a no-op for call-site compatibility.
  setToken() {},

  async register({ email, password, full_name }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name } },
    });
    if (error) throw error;
    return data;
  },

  async verifyEmail(email, code) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error) throw error;
    return data;
  },

  async resendVerificationCode(email) {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw error;
    return true;
  },

  async resetPasswordRequest(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return true;
  },

  // Must await signOut() before navigating — it clears the persisted session
  // from storage asynchronously. Hard-navigating first can race it and leave
  // the session behind, silently signing the user back in on next load.
  async logout(redirect = true) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Network failure revoking server-side — the local session is still
      // cleared below so the user genuinely lands back on the login screen.
    }
    if (redirect) window.location.href = '/';
  },
};

const functions = {
  // Maps 1:1 onto Supabase Edge Functions — invoke('fetchTickerPrice', { ticker })
  async invoke(name, payload = {}) {
    const { data, error } = await supabase.functions.invoke(name, { body: payload });
    if (error) throw error;
    return { data };
  },
};

export const base44 = { auth, entities, functions };
export default base44;

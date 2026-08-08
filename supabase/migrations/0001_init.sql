-- MillionTSP: Base44 -> Supabase schema migration
-- Translates the 11 Base44 entities (and their RLS rules) into Postgres tables.
-- Ownership model: every user-data table has created_by_id uuid referencing auth.users,
-- defaulting to auth.uid() so the app never has to set it explicitly. RLS enforces that
-- a user can only read/write rows where created_by_id = auth.uid() (mirrors the RLS
-- added in the Base44 app: TSPProfile, FundAllocation, DailyBalance, Beneficiary,
-- AppNotification, AnnualSummary, AnnualPerformance, OpeningBalanceHistory,
-- FundDailySnapshot were all locked to created_by_id; TSPHistoricalPrice stayed
-- shared-read/admin-write; User.role was locked to admin-only updates).

create extension if not exists "pgcrypto";

-- ============================================================================
-- user_roles — replaces Base44's built-in User.role field.
-- Supabase's auth.users table is managed by the platform and shouldn't carry
-- app-specific columns directly, so role lives in a companion table.
-- ============================================================================
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('admin', 'user')),
  created_date timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- Everyone can read their own role (needed for admin-gated UI checks).
create policy user_roles_select_own on public.user_roles
  for select using (user_id = auth.uid());

-- Nobody can self-escalate: role can only be changed by an existing admin.
-- (No insert/update policy for regular users at all — writes go through the
-- service_role key from a trusted backend function, or an admin using a
-- security-definer RPC. This is intentionally stricter than a same-row check
-- because same-row checks on the NEW row don't stop a user setting role='admin'
-- on their own insert.)
create policy user_roles_admin_write on public.user_roles
  for all using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  );

-- Auto-create a 'user' role row whenever someone signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- tsp_profiles  (Base44: TSPProfile)
-- ============================================================================
create table public.tsp_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  name text not null,
  plan text not null default 'free' check (plan in ('free', 'trial', 'paid')),
  trial_start_date date,
  trial_end_date date,
  trial_used boolean not null default false,
  employment_type text not null default 'civilian' check (employment_type in ('civilian', 'military')),
  balance_goal numeric,
  goal_method text not null default 'trailing' check (goal_method in ('trailing', 'fixed')),
  fixed_annual_return numeric,
  opening_balance numeric,
  opening_balance_excl_loan numeric,
  traditional_contributions numeric not null default 0,
  roth_contributions numeric not null default 0,
  agency_match numeric not null default 0,
  auto_1_percent numeric not null default 0,
  loan_repayments numeric not null default 0,
  loan_end_date date,
  fees numeric not null default 0,
  highest_balance numeric not null default 0,
  highest_balance_date date,
  date_of_birth date,
  career_start_date date,
  planned_retirement_date date,
  earliest_retirement_date date,
  earliest_retirement_rule text,
  ss_claiming_age_years numeric,
  ss_claiming_age_months numeric not null default 0,
  current_annual_salary numeric,
  salary_year_1 numeric,
  salary_year_2 numeric,
  salary_year_3 numeric,
  retirement_system text not null default 'FERS' check (retirement_system in ('FERS', 'CSRS')),
  ss_monthly_benefit numeric,
  ss_start_age numeric not null default 62,
  tsp_withdrawal_method text not null default 'fixed_percent' check (tsp_withdrawal_method in ('fixed_percent', 'fixed_dollar', 'life_expectancy')),
  tsp_withdrawal_percent numeric,
  tsp_withdrawal_amount numeric,
  color_theme text not null default 'black' check (color_theme in ('black', 'light')),
  notification_enabled boolean not null default true,
  notif_nightly_email boolean not null default true,
  notif_all_time_high boolean not null default true,
  notif_big_drop boolean not null default true,
  notif_big_drop_threshold numeric not null default 2,
  notif_goal_off_track boolean not null default true,
  notif_weekly_checkin boolean not null default true,
  notif_email_address text,
  notif_email_time text not null default '16:30',
  notif_milestone_amounts jsonb not null default '[]'::jsonb,
  notif_fund_drop_threshold numeric,
  notif_near_goal_days numeric not null default 365,
  notif_ytd_gain_threshold numeric,
  notif_goal_original_date date,
  entry_method text not null default 'percent' check (entry_method in ('percent', 'dollar')),
  total_balance_manual numeric,
  balance_last_confirmed date,
  balance_install_date date,
  mfw_balance numeric not null default 0,
  mfw_last_updated date,
  has_mfw boolean not null default false,
  mfw_holdings jsonb not null default '[]'::jsonb,
  sick_leave_current_hours numeric not null default 0,
  sick_leave_estimated_hours numeric not null default 0,
  agency_type text not null default 'usps' check (agency_type in ('usps', 'standard_fers', 'csrs')),
  pay_schedule text not null default 'biweekly' check (pay_schedule in ('biweekly', 'monthly')),
  contrib_traditional_mode text not null default 'percent' check (contrib_traditional_mode in ('percent', 'dollar')),
  contrib_traditional_percent numeric not null default 0,
  contrib_traditional_dollar numeric not null default 0,
  contrib_roth_mode text not null default 'percent' check (contrib_roth_mode in ('percent', 'dollar')),
  contrib_roth_percent numeric not null default 0,
  contrib_roth_dollar numeric not null default 0,
  contrib_loan_per_period numeric not null default 0
);

create index tsp_profiles_created_by_id_idx on public.tsp_profiles(created_by_id);

alter table public.tsp_profiles enable row level security;
create policy tsp_profiles_owner_select on public.tsp_profiles for select using (created_by_id = auth.uid());
create policy tsp_profiles_owner_insert on public.tsp_profiles for insert with check (created_by_id = auth.uid());
create policy tsp_profiles_owner_update on public.tsp_profiles for update using (created_by_id = auth.uid());
create policy tsp_profiles_owner_delete on public.tsp_profiles for delete using (created_by_id = auth.uid());

-- ============================================================================
-- Generic pattern for the remaining "owned via profile_id" entities: every one
-- of these also carries created_by_id directly (mirrors Base44's root-level
-- created_by_id) so RLS doesn't need a join back to tsp_profiles.
-- ============================================================================

-- opening_balance_history  (Base44: OpeningBalanceHistory)
create table public.opening_balance_history (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  year numeric not null,
  opening_balance numeric not null,
  source text not null default 'manual' check (source in ('manual', 'auto')),
  source_date date,
  closing_balance numeric
);
create index opening_balance_history_profile_id_idx on public.opening_balance_history(profile_id);
alter table public.opening_balance_history enable row level security;
create policy opening_balance_history_owner_all on public.opening_balance_history
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- fund_allocations  (Base44: FundAllocation)
create table public.fund_allocations (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  fund_name text not null,
  fund_type text check (fund_type in ('core', 'lifecycle')),
  is_selected boolean not null default false,
  allocation_percent numeric not null default 0,
  dollar_balance numeric not null default 0,
  balance numeric not null default 0,
  shares numeric not null default 0,
  share_price numeric not null default 0,
  previous_share_price numeric not null default 0,
  jan1_share_price numeric not null default 0,
  wtd_share_price numeric not null default 0,
  mtd_share_price numeric not null default 0,
  return_percent numeric not null default 0,
  daily_return_percent numeric not null default 0,
  wtd_return_percent numeric not null default 0,
  mtd_return_percent numeric not null default 0,
  last_price_update date
);
create index fund_allocations_profile_id_idx on public.fund_allocations(profile_id);
alter table public.fund_allocations enable row level security;
create policy fund_allocations_owner_all on public.fund_allocations
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- tsp_historical_prices  (Base44: TSPHistoricalPrice) — shared reference data,
-- NOT user-owned. Readable by any authenticated user; only admins can write.
create table public.tsp_historical_prices (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),

  date date not null,
  fund_name text not null check (fund_name in ('G','F','C','S','I','L Income','L2030','L2035','L2040','L2045','L2050','L2055','L2060','L2065','L2070','L2075')),
  share_price numeric not null,
  unique (date, fund_name)
);
create index tsp_historical_prices_date_idx on public.tsp_historical_prices(date);
alter table public.tsp_historical_prices enable row level security;
create policy tsp_historical_prices_read_all on public.tsp_historical_prices
  for select using (auth.role() = 'authenticated');
create policy tsp_historical_prices_admin_write on public.tsp_historical_prices
  for all using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  );

-- app_notifications  (Base44: AppNotification)
create table public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  type text not null check (type in ('nightly_balance','all_time_high','big_drop','goal_off_track','goal_on_track','new_contribution','milestone','fund_drop','near_goal_date','ytd_gain')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false
);
create index app_notifications_profile_id_idx on public.app_notifications(profile_id);
alter table public.app_notifications enable row level security;
create policy app_notifications_owner_all on public.app_notifications
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- annual_summaries  (Base44: AnnualSummary)
create table public.annual_summaries (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  year numeric not null,
  fund_name text,
  opening_balance numeric not null default 0,
  closing_balance numeric not null default 0,
  annual_return_percent numeric not null default 0,
  gain_loss_dollars numeric not null default 0,
  opening_share_price numeric not null default 0,
  closing_share_price numeric not null default 0,
  opening_shares numeric not null default 0,
  closing_shares numeric not null default 0,
  best_day_date date,
  best_day_gain numeric not null default 0,
  worst_day_date date,
  worst_day_loss numeric not null default 0,
  gain_days numeric not null default 0,
  loss_days numeric not null default 0,
  total_contributions numeric not null default 0,
  is_complete boolean not null default false
);
create index annual_summaries_profile_id_idx on public.annual_summaries(profile_id);
alter table public.annual_summaries enable row level security;
create policy annual_summaries_owner_all on public.annual_summaries
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- annual_performances  (Base44: AnnualPerformance)
create table public.annual_performances (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  year numeric not null,
  opening_balance numeric,
  closing_balance numeric,
  ytd_percent numeric,
  gain_loss_dollars numeric,
  best_day_date date,
  best_day_change numeric,
  worst_day_date date,
  worst_day_change numeric,
  gain_days numeric not null default 0,
  loss_days numeric not null default 0,
  traditional_contributions numeric not null default 0,
  roth_contributions numeric not null default 0,
  agency_match numeric not null default 0,
  is_complete boolean not null default false
);
create index annual_performances_profile_id_idx on public.annual_performances(profile_id);
alter table public.annual_performances enable row level security;
create policy annual_performances_owner_all on public.annual_performances
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- beneficiaries  (Base44: Beneficiary)
create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  name text not null,
  relationship text,
  percentage numeric,
  type text not null default 'primary' check (type in ('primary', 'contingent')),
  last_updated date
);
create index beneficiaries_profile_id_idx on public.beneficiaries(profile_id);
alter table public.beneficiaries enable row level security;
create policy beneficiaries_owner_all on public.beneficiaries
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- fund_daily_snapshots  (Base44: FundDailySnapshot)
create table public.fund_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  fund_name text not null,
  date date not null,
  share_price numeric not null default 0,
  shares numeric not null default 0,
  balance numeric not null default 0,
  daily_change_dollars numeric not null default 0,
  daily_change_percent numeric not null default 0,
  wtd_percent numeric not null default 0,
  mtd_percent numeric not null default 0,
  ytd_percent numeric not null default 0,
  portfolio_weight numeric not null default 0,
  is_estimated_baseline boolean not null default false,
  unique (profile_id, fund_name, date)
);
create index fund_daily_snapshots_profile_id_date_idx on public.fund_daily_snapshots(profile_id, date);
alter table public.fund_daily_snapshots enable row level security;
create policy fund_daily_snapshots_owner_all on public.fund_daily_snapshots
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- daily_balances  (Base44: DailyBalance)
create table public.daily_balances (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,
  date date not null,
  balance numeric not null,
  daily_change numeric,
  daily_change_percent numeric,
  is_gain boolean,
  unique (profile_id, date)
);
create index daily_balances_profile_id_date_idx on public.daily_balances(profile_id, date);
alter table public.daily_balances enable row level security;
create policy daily_balances_owner_all on public.daily_balances
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- ============================================================================
-- updated_date auto-touch trigger, applied to every owned table.
-- ============================================================================
create function public.touch_updated_date()
returns trigger as $$
begin
  new.updated_date = now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tsp_profiles','opening_balance_history','fund_allocations','app_notifications',
    'annual_summaries','annual_performances','beneficiaries','fund_daily_snapshots','daily_balances'
  ] loop
    execute format('create trigger touch_updated_date before update on public.%I for each row execute procedure public.touch_updated_date();', t);
  end loop;
end $$;

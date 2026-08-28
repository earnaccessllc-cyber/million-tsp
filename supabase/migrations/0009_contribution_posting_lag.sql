-- Credit pay-day money when TSP actually posts it, not when payroll takes it.
--
-- 0008 stopped crediting contributions on the pay date, because doing so made
-- the balance run ahead of tsp.gov until TSP caught up. That removed the drift
-- but left the deposit missing entirely until someone reconciled by hand.
--
-- The real shape of the thing is a delay, not an absence: payroll takes the
-- money on the pay date, TSP posts it to the account a few business days
-- later, and buys units at the price on the day it posts. Modelling that delay
-- explicitly gets both halves right — the balance stops sawtoothing against
-- tsp.gov, AND the units are bought at the price TSP actually paid, which
-- crediting on the pay date never did either.
--
-- Two pieces:
--
--   contribution_posting_lag_days  how long the wait is, in business days.
--   pending_contributions          what is waiting, and when it is due.
--
-- The queue matters more than it looks. "Was there a pay day N days ago" would
-- silently drop a deposit whose posting date landed on a weekend or holiday,
-- since the price job only runs on market days. A row that stays unposted
-- until it is credited cannot be dropped, is idempotent against re-runs, and
-- can be inspected when a number looks wrong.

alter table public.tsp_profiles
  add column if not exists contribution_posting_lag_days integer not null default 3;

comment on column public.tsp_profiles.contribution_posting_lag_days is
  'Business days between the pay date and the day TSP posts the deposit. Default 3 is a starting estimate; the exact value varies by agency and payroll provider, and should be set from the participant''s own TSP transaction history. 0 credits on the pay date itself.';

create table if not exists public.pending_contributions (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),

  profile_id uuid not null references public.tsp_profiles(id) on delete cascade,

  -- The day payroll took the money.
  pay_date date not null,
  -- The market day it is expected to land in the TSP account. Derived from
  -- pay_date + contribution_posting_lag_days business days at enqueue time, so
  -- changing the setting later doesn't retroactively move money that is
  -- already in flight.
  post_date date not null,

  -- Split out rather than summed so a balance that looks wrong can be traced
  -- back to which component was off.
  contribution_amount numeric not null default 0,
  loan_repayment_amount numeric not null default 0,

  -- The market day it was actually credited, and the instant of the write.
  -- Null means still in flight.
  posted_on date,
  posted_at timestamptz,

  -- One row per profile per pay date: the price job is polled every couple of
  -- minutes, and without this each poll on a pay day would enqueue the deposit
  -- again.
  unique (profile_id, pay_date)
);

create index if not exists pending_contributions_profile_id_idx
  on public.pending_contributions(profile_id);
-- The job's hot path is "what is due and not yet posted for this profile".
create index if not exists pending_contributions_due_idx
  on public.pending_contributions(profile_id, post_date)
  where posted_at is null;

alter table public.pending_contributions enable row level security;
create policy pending_contributions_owner_all on public.pending_contributions
  for all using (created_by_id = auth.uid()) with check (created_by_id = auth.uid());

-- Where the queue starts. The price job enqueues the most recent pay date on
-- or before today, which on its own would backfill a pay period that a
-- reconciled balance already accounts for the first time a profile turns
-- crediting on. Nothing before this date is ever enqueued, and null means
-- nothing at all is — so the safe state is the default, and enabling crediting
-- is an explicit act with an explicit start.
alter table public.tsp_profiles
  add column if not exists contribution_credit_from date;

comment on column public.tsp_profiles.contribution_credit_from is
  'Earliest pay date eligible to be queued for crediting. Set to the date crediting was switched on, so the queue cannot reach back into a period already reflected in a reconciled balance. Null queues nothing.';

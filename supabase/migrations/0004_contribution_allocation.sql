-- Contribution allocation ("Future Investment" on TSP.gov) is a separate
-- setting from the current mix, and the two routinely differ.
--
-- allocation_percent holds the *current mix* — what fraction of the balance
-- each fund currently represents. That is an outcome: it drifts every day as
-- funds diverge. TSP.gov's "Future Investment" percentages instead say where
-- each new dollar goes, and they only change when the participant changes them.
--
-- A real example: a participant holding C 5% / S 5% / I 75% while contributing
-- C 20% / S 20% / I 60%. Splitting contributions by the current mix would buy
-- the wrong funds entirely.
alter table public.fund_allocations
  add column if not exists contribution_percent numeric not null default 0;

comment on column public.fund_allocations.contribution_percent is
  'Share of each new contribution directed to this fund (TSP.gov "Future Investment" %). Distinct from allocation_percent, which is the current mix.';

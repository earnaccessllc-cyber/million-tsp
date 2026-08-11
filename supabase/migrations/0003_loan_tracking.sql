-- Pay-day anchoring + multi-loan tracking. Applied directly to the live
-- project via mcp__Supabase__apply_migration in two passes (the first pass
-- added single-loan columns that were superseded by the loans array before
-- this file was updated to match); this file documents the final schema for
-- anyone rebuilding from scratch.

alter table public.tsp_profiles add column pay_date_anchor date;
comment on column public.tsp_profiles.pay_date_anchor is 'A known real pay date, used to anchor the biweekly pay-day cycle for contribution accrual instead of assuming alignment to Jan 1.';

-- A profile can have more than one active TSP loan (general purpose +
-- residential, etc.), each tracked independently.
alter table public.tsp_profiles add column loans jsonb not null default '[]'::jsonb;
comment on column public.tsp_profiles.loans is 'Array of {id, label, original_amount, start_date, per_period_payment, repaid} — one entry per active TSP loan. repaid is a running cumulative total incremented each pay period by dailyPriceUpdate, capped at original_amount.';

-- Tracks the last market day dailyPriceUpdate found genuinely nothing left
-- to do for a profile: today's prices already match the stored ones AND
-- there was no pending contribution/loan payment due. That is the earliest
-- point at which the day's balance can be treated as settled.
--
-- Without this, "a daily_balances row exists for today" was being used as
-- the readiness signal for the nightly email, but dailyPriceUpdate polls
-- repeatedly through the evening and can revise that same row again hours
-- later (a further price correction, or a contribution posting) — so an
-- email sent right at its due time could capture a balance that gets
-- superseded that same night. Confirmed 2026-09-15: the row was created at
-- 8:30pm ET (crediting a newly-due contribution) and revised again at
-- 11:30pm ET with the actual market close, but the email had already sent
-- at 8:50pm using the intermediate figure — off by $2,342.73.
--
-- Applied directly via mcp__Supabase__apply_migration; this file documents
-- it for anyone rebuilding from scratch.

alter table public.tsp_profiles add column balance_finalized_date date;
comment on column public.tsp_profiles.balance_finalized_date is 'Last market day dailyPriceUpdate found nothing left to do for this profile (prices already stored, no contribution due) — the earliest point the day''s balance can be treated as settled. Distinct from balance_last_confirmed, which is set on every write, including ones later superseded.';

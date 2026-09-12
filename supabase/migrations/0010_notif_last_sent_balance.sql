-- Tracks the account balance as of the last nightly email, so the email's
-- reported daily change is "since the last email" rather than "since the
-- prior trading day's close" — the two differ whenever pricing settles
-- (or resettles) after the email's due time, which was producing changes
-- that didn't match what the next night's email actually compared against.
-- Applied directly via mcp__Supabase__apply_migration; this file documents
-- it for anyone rebuilding from scratch.

alter table public.tsp_profiles add column notif_last_sent_balance numeric;
comment on column public.tsp_profiles.notif_last_sent_balance is 'Total balance as of the last nightly balance email, used to compute that email''s reported change against the previous one rather than the prior trading day''s close.';

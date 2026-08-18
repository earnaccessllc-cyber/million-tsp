-- Tracks the last date the nightly balance email was sent per profile, so the
-- nightlyEmailJob (which polls every 15 minutes to honor each user's chosen
-- notif_email_time) sends at most once per day. Applied directly via
-- mcp__Supabase__apply_migration; this file documents it for anyone
-- rebuilding from scratch.

alter table public.tsp_profiles add column notif_last_sent_date date;
comment on column public.tsp_profiles.notif_last_sent_date is 'Date the nightly balance email was last sent, used to ensure at most one send per day once the profile''s notif_email_time has passed.';

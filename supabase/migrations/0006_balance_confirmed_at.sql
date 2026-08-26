-- balance_last_confirmed is a DATE, so the UI had no update time to show and
-- fell back to a hardcoded "8:00pm ET" string. That string was wrong on both
-- counts once the price update became a poll: the time varies with when the
-- sheet publishes, and it isn't Eastern for every user. Record the actual
-- instant the balance was last priced so the app can show a real time beside
-- the date, rendered in the viewer's own timezone.
alter table public.tsp_profiles
  add column if not exists balance_last_confirmed_at timestamptz;

-- Backfill so the label has something to render immediately. updated_date is
-- the closest existing approximation of when the balance was last written.
update public.tsp_profiles
   set balance_last_confirmed_at = updated_date
 where balance_last_confirmed_at is null;

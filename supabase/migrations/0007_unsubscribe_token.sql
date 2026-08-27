-- A per-profile secret that identifies a subscriber from inside an email,
-- where there is no session to authenticate against. Random and revocable:
-- rotating it invalidates links in already-delivered mail, and it carries no
-- authority beyond turning nightly email off.
alter table public.tsp_profiles
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists tsp_profiles_unsubscribe_token_key
  on public.tsp_profiles (unsubscribe_token);

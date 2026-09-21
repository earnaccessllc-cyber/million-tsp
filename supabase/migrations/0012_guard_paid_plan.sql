-- Closes the "free unlock" hole: the tsp_profiles owner INSERT/UPDATE
-- policies let any signed-in user write their own row, so anyone could set
-- plan='paid' straight from the browser console. Access is now only granted
-- server-side — stripeWebhook (web) and verifyPurchase (iOS, via RevenueCat)
-- both use the service role, which this trigger lets through.
--
-- DO NOT APPLY until the app build that calls verifyPurchase is live: older
-- builds set plan='paid' from the client after an Apple purchase, and this
-- trigger would block that (the user would be charged but not unlocked).
--
-- Direct SQL (SQL editor / MCP execute_sql) runs with no JWT role, so
-- auth.role() is null there and manual fixes still work.

create or replace function public.guard_paid_plan()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.plan = 'paid'
     and (tg_op = 'INSERT' or old.plan is distinct from 'paid')
     and auth.role() in ('authenticated', 'anon') then
    raise exception 'plan can only be set to paid by the server' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_paid_plan on public.tsp_profiles;
create trigger guard_paid_plan
  before insert or update on public.tsp_profiles
  for each row execute function public.guard_paid_plan();

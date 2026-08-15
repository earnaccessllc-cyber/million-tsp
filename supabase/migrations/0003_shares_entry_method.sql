-- Share-based tracking: mirrors how TSP actually works.
--
-- A TSP participant owns a number of shares in each fund. Each business day TSP
-- publishes a share price per fund, and the account balance is simply
-- shares x share price. Share counts change only when money moves
-- (contributions, loan repayments, interfund transfers) — never from market
-- movement. Because of that, allocations drift as funds diverge, and TSP does
-- not rebalance you automatically.
--
-- The existing 'percent' method re-derives every fund from
-- total x allocation % on each nightly run, which silently forces the
-- portfolio back to its target weights every night and cannot represent that
-- drift. 'shares' stores the share count as the source of truth instead.

do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.tsp_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%entry_method%';

  if c is not null then
    execute format('alter table public.tsp_profiles drop constraint %I', c);
  end if;
end $$;

alter table public.tsp_profiles
  add constraint tsp_profiles_entry_method_check
  check (entry_method in ('percent', 'dollar', 'shares'));

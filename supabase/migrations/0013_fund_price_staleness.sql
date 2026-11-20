-- Tracks, per fund, the price last seen on the live-prices sheet and the market
-- day it first appeared. dailyPriceUpdate uses it to flag a fund whose price
-- has stopped changing (the sheet's G Fund sat at 19.9175 from at least
-- 2026-09-23 to 2026-11-04 while the real G Fund rises every market day).
create table if not exists public.fund_price_staleness (
  fund_name text primary key,
  price numeric not null,
  unchanged_since date not null,
  updated_at timestamptz not null default now()
);

alter table public.fund_price_staleness enable row level security;

-- Seed the price already known to be stuck so it is flagged immediately
-- instead of only after three more unchanged days.
insert into public.fund_price_staleness (fund_name, price, unchanged_since)
values ('G Fund', 19.9175, '2026-09-23')
on conflict (fund_name) do nothing;

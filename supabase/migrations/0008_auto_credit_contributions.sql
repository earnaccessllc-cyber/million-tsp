-- Stop the nightly job from crediting pay-day money to the balance.
--
-- dailyPriceUpdate added each pay period's contribution, agency match and loan
-- repayment to the balance on the pay date itself. TSP does not: the deposit
-- posts to the account several days later. So for a few days every pay period
-- the app read high by exactly that amount, then snapped back into line when
-- TSP caught up. Measured on 2026-08-27: the app was $330.07 above tsp.gov,
-- and contributions + match for the period were $330.10.
--
-- The balance now moves only when prices move, and payroll deposits show up
-- when they show up on tsp.gov — accurate rather than predictive. Default
-- false for that reason; a profile that would rather see the money credited
-- immediately can set this true and accept the lead.
--
-- This does not change loan tracking. loan.repaid still advances on the pay
-- date regardless of this setting: how much of a loan payroll has taken out of
-- your pay is a fact about payroll, not about when TSP posts the deposit.
alter table public.tsp_profiles
  add column if not exists auto_credit_contributions boolean not null default false;

comment on column public.tsp_profiles.auto_credit_contributions is
  'When true, dailyPriceUpdate adds the pay-period contribution, agency match and loan repayment to the balance on the pay date. Default false: TSP posts those days later, so crediting on the pay date makes the balance run ahead of tsp.gov until it catches up.';

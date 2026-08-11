-- Loan tracking: original amount, start date, and reuse of the existing
-- loan_repayments column as a running cumulative-repaid total (previously
-- unused). Applied directly to the live project via mcp__Supabase__apply_migration;
-- this file documents that change for anyone rebuilding the schema from scratch.

alter table public.tsp_profiles add column loan_original_amount numeric;
alter table public.tsp_profiles add column loan_start_date date;
alter table public.tsp_profiles add column pay_date_anchor date;

comment on column public.tsp_profiles.loan_original_amount is 'Original TSP loan principal amount.';
comment on column public.tsp_profiles.loan_start_date is 'Date the TSP loan was originated.';
comment on column public.tsp_profiles.loan_repayments is 'Cumulative amount repaid toward the loan so far (incremented each pay period by dailyPriceUpdate).';
comment on column public.tsp_profiles.pay_date_anchor is 'A known real pay date, used to anchor the biweekly pay-day cycle for contribution accrual instead of assuming alignment to Jan 1.';

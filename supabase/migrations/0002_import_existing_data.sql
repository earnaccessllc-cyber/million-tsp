-- MillionTSP: one-time import of existing Base44 data into Supabase.
-- Attaches your real profile, funds, balance history, and notifications to
-- the account you signed up with: tony_damailman@yahoo.com
-- Safe to run once. Re-running will error on the year/date unique constraints
-- rather than silently duplicating rows.

do $$
declare
  v_user_id uuid;
  v_profile_id uuid;
begin
  select id into v_user_id from auth.users where email = 'tony_damailman@yahoo.com' limit 1;
  if v_user_id is null then
    raise exception 'No auth user found for tony_damailman@yahoo.com — sign up with that email on the app first, then re-run this script.';
  end if;

  -- ==========================================================================
  -- tsp_profiles (1 row)
  -- ==========================================================================
  insert into public.tsp_profiles (
    created_by_id, name, plan, trial_start_date, trial_end_date, trial_used, employment_type,
    balance_goal, goal_method, fixed_annual_return, opening_balance, opening_balance_excl_loan,
    traditional_contributions, roth_contributions, agency_match, auto_1_percent, loan_repayments,
    loan_end_date, fees, highest_balance, highest_balance_date, date_of_birth, career_start_date,
    planned_retirement_date, earliest_retirement_date, earliest_retirement_rule,
    ss_claiming_age_years, ss_claiming_age_months, current_annual_salary, salary_year_1, salary_year_2,
    salary_year_3, retirement_system, ss_monthly_benefit, ss_start_age, tsp_withdrawal_method,
    tsp_withdrawal_percent, tsp_withdrawal_amount, color_theme, notification_enabled,
    notif_nightly_email, notif_all_time_high, notif_big_drop, notif_big_drop_threshold,
    notif_goal_off_track, notif_weekly_checkin, notif_email_address, notif_email_time,
    notif_milestone_amounts, notif_fund_drop_threshold, notif_near_goal_days, notif_ytd_gain_threshold,
    notif_goal_original_date, entry_method, total_balance_manual, balance_last_confirmed,
    balance_install_date, mfw_balance, mfw_last_updated, has_mfw, mfw_holdings,
    sick_leave_current_hours, sick_leave_estimated_hours, agency_type, pay_schedule,
    contrib_traditional_mode, contrib_traditional_percent, contrib_traditional_dollar,
    contrib_roth_mode, contrib_roth_percent, contrib_roth_dollar, contrib_loan_per_period
  ) values (
    v_user_id, 'ajohnson', 'paid', null, null, true, 'civilian',
    1250000, 'fixed', 9, 327417.8178377727, null,
    0, 0, 0, 0, 0,
    '2027-10-31', 0, 466061.8, '2026-08-05', '1979-06-29', '1998-08-28',
    '2036-06-29', null, null,
    62, 0, 83226, 83000, 83000,
    83000, 'FERS', 3472, 62, 'fixed_percent',
    4, null, 'black', true,
    true, true, true, 2,
    true, true, '', '20:00',
    '[]'::jsonb, null, 365, null,
    null, 'percent', 464431.68834284256, '2026-08-08',
    '2026-07-05', 70378.64908184264, '2026-08-08', true,
    '[{"ticker":"FSELX","shares":1101.2149754630361,"last_price":63.91,"last_updated":"2026-08-08"}]'::jsonb,
    0, 0, 'usps', 'biweekly',
    'percent', 5, 0,
    'dollar', 0, 10, 437
  ) returning id into v_profile_id;

  -- ==========================================================================
  -- fund_allocations (15 rows)
  -- ==========================================================================
  insert into public.fund_allocations (
    created_by_id, profile_id, fund_name, fund_type, is_selected, allocation_percent, dollar_balance,
    balance, shares, share_price, previous_share_price, jan1_share_price, wtd_share_price,
    mtd_share_price, return_percent, daily_return_percent, wtd_return_percent, mtd_return_percent,
    last_price_update
  ) values
    (v_user_id, v_profile_id, 'L 2035', 'lifecycle', false, 0, 0, 0, 0, 19.6295, 19.6295, 17.7506, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'G Fund', 'core', false, 0, 0, 0, 0, 19.9175, 19.9175, 19.5922, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'I Fund', 'core', true, 74, 347260.14307999995, 347260.14307999995, 5299.4, 65.5282, 65.0703, 56.0292, 65.0703, 65.0703, 18.09, 0.7, 2.37, 2.37, '2026-08-08'),
    (v_user_id, v_profile_id, 'C Fund', 'core', true, 5, 23368.41837, 23368.41837, 187.05, 124.9314, 124.1579, 109.7449, 124.1579, 124.1579, 14.08, 0.62, 3.59, 3.59, '2026-08-08'),
    (v_user_id, v_profile_id, 'L 2045', 'lifecycle', false, 0, 0, 0, 0, 21.086, 21.086, 18.8435, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'L 2050', 'lifecycle', false, 0, 0, 0, 0, 46.9869, 46.9869, 41.7575, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'S Fund', 'core', true, 5, 23424.477811, 23424.477811, 196.19, 119.3969, 117.3501, 101.6677, 117.3501, 117.3501, 18.91, 1.74, 4.75, 4.75, '2026-08-08'),
    (v_user_id, v_profile_id, 'L 2025', 'lifecycle', false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, null),
    (v_user_id, v_profile_id, 'L 2065', 'lifecycle', false, 0, 0, 0, 0, 24.7516, 24.7516, 21.5541, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'L 2040', 'lifecycle', false, 0, 0, 0, 0, 75.7687, 75.7687, 68.0819, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'L 2055', 'lifecycle', false, 0, 0, 0, 0, 24.7581, 24.7581, 21.5591, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'F Fund', 'core', false, 0, 0, 0, 0, 20.8985, 20.9986, 20.8602, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'L 2060', 'lifecycle', false, 0, 0, 0, 0, 24.7549, 24.7549, 21.5566, 0, 0, 0, 0, 0, 0, '2026-08-05'),
    (v_user_id, v_profile_id, 'L Income', 'lifecycle', false, 0, 0, 0, 0, 31.0238, 30.7572, 29.2952, 0, 0, -0.92, 0.14, 0.38, 0.52, '2026-08-05'),
    (v_user_id, v_profile_id, 'L 2030', 'lifecycle', false, 0, 0, 0, 0, 63.683, 63.683, 58.3022, 0, 0, 0, 0, 0, 0, '2026-08-05');

  -- ==========================================================================
  -- daily_balances (26 rows)
  -- ==========================================================================
  insert into public.daily_balances (created_by_id, profile_id, date, balance, daily_change, daily_change_percent, is_gain) values
    (v_user_id, v_profile_id, '2026-07-06', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-07', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-08', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-09', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-10', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-13', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-14', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-15', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-16', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-17', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-20', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-21', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-22', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-23', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-24', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-27', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-28', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-29', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-30', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-07-31', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-08-03', 385586.87999999995, 0, 0, true),
    (v_user_id, v_profile_id, '2026-08-04', 385586.88, 0, 0, true),
    (v_user_id, v_profile_id, '2026-08-05', 403159.8152682001, 17572.93526820012, 4.5574515575322785, true),
    (v_user_id, v_profile_id, '2026-08-06', 399146.62775448215, -4013.187513717974, -0.9954334141780029, false),
    (v_user_id, v_profile_id, '2026-08-07', 396232.7416544579, -2913.886100024276, -0.7300289912048631, false),
    (v_user_id, v_profile_id, '2026-08-08', 464431.68834284256, 68198.94668838469, 17.211840294575868, true);

  -- ==========================================================================
  -- app_notifications (41 rows)
  -- ==========================================================================
  insert into public.app_notifications (created_by_id, profile_id, type, title, message, is_read, is_dismissed) values
    (v_user_id, v_profile_id, 'nightly_balance', '🎊 Happy New Year! 2026 Baseline Set', 'Your TSP opening balance for 2026 has been automatically set to $327,418 based on your last recorded balance. Please verify and update if needed.', false, false),
    (v_user_id, v_profile_id, 'big_drop', '📉 YTD Turned Negative', 'Your TSP YTD dipped to -0.42%. Market downturns are normal — stay the course.', false, true),
    (v_user_id, v_profile_id, 'all_time_high', '🎉 New All-Time High!', 'Your balance hit $385,587 — a new personal record!', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'big_drop', '⚠️ Balance Drop Alert', 'Balance dropped 100.00% today. Current: $385,587', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • -$385,587 (-100.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • +$0 (+0.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • +$0 (+0.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • +$0 (+0.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • +$0 (+0.00%) today • On track for goal', false, true),
    (v_user_id, v_profile_id, 'nightly_balance', 'Nightly Balance Update', '$385,587 total • +$0 (+0.00%) today • On track for goal', false, true);

  -- ==========================================================================
  -- annual_performances (1 row)
  -- ==========================================================================
  insert into public.annual_performances (
    created_by_id, profile_id, year, opening_balance, closing_balance, ytd_percent, gain_loss_dollars,
    best_day_date, best_day_change, worst_day_date, worst_day_change, gain_days, loss_days,
    traditional_contributions, roth_contributions, agency_match, is_complete
  ) values (
    v_user_id, v_profile_id, 2026, 387217, 327417.8178377727, -15.443373660455304, -59799.402162227256,
    '2026-08-05', 17572.93526820012, '2026-08-06', -4013.187513717974, 1, 2,
    0, 0, 0, false
  );

  -- ==========================================================================
  -- opening_balance_history (1 row)
  -- ==========================================================================
  insert into public.opening_balance_history (
    created_by_id, profile_id, year, opening_balance, source, source_date, closing_balance
  ) values (
    v_user_id, v_profile_id, 2026, 327417.8178377727, 'auto', '2026-08-08', null
  );

  raise notice 'Import complete. New profile id: %', v_profile_id;
end $$;

import { useProfile } from '@/context/ProfileContext';
import { hasFullAccess } from '@/lib/trialUtils';

export const PLAN_NAME = 'MillionTSP Pro';

/**
 * Single source of truth for what the free tier includes.
 *
 * The split was previously implicit — each page decided for itself, with the
 * copy for each locked feature written inline at the call site. That let the
 * tiers drift apart (Analytics gated on `plan === 'paid'` and so locked out
 * trial users that every other screen let in) and made "what do you actually
 * get for free?" unanswerable without reading six files.
 *
 * Free tier: daily balance tracking and goal progress. The current balance,
 * the day's change, fund prices and allocations, and progress toward a
 * savings goal — the reason to open the app each evening. Plus whatever is
 * needed to set that up, since a free tier you can't configure is not a free
 * tier.
 *
 * Everything that interprets, projects, or plans from that balance is Pro.
 */
export const FEATURES = {
  // Free — the daily habit, and what it takes to get there.
  daily_balance:         { label: 'Daily balance tracking', free: true },
  fund_prices:           { label: 'Fund prices and allocations', free: true },
  market_mood:           { label: 'Market mood', free: true },
  account_setup:         { label: 'Account setup and balance entry', free: true },

  // Pro — everything derived from the balance.
  goal_tracking:         { label: 'Goal tracking and the millionaire tracker', free: true },
  dashboard_insights:    { label: 'Sick leave credits and YTD activity', free: false },
  daily_log:             { label: 'Daily balance history', free: false },
  retirement_countdown:  { label: 'Retirement countdown, savings streaks, and milestone tracking', free: false },
  retirement_benefits:   { label: 'FERS/CSRS eligibility rules, pension calculator, and income timeline', free: false },
  retirement_tools:      { label: 'TSP loan calculator and planning tools', free: false },
  analytics:             { label: 'Contribution optimizer, risk scoring, inflation analysis, and fund comparison', free: false },
  notifications:         { label: 'Notifications, goals, and the tax estimator', free: false },
  tsp_vs_private:        { label: 'TSP vs. private sector comparison', free: false },
  tax_estimator:         { label: 'The tax estimator', free: false },
  fire_calculator:       { label: 'The FIRE calculator', free: false },
  smart_rebalancing:     { label: 'Smart rebalancing', free: false },
  fitness_score:         { label: 'The financial fitness score', free: false },
};

export const PRO_FEATURES = Object.keys(FEATURES).filter(k => !FEATURES[k].free);

export function featureLabel(key) {
  return FEATURES[key]?.label || 'This feature';
}

export function isFreeFeature(key) {
  return FEATURES[key]?.free === true;
}

// Pro is unlocked by a paid plan or an active (unexpired) trial — the same rule
// PaywallScreen uses to decide whether to show itself.
export function useProStatus() {
  const { activeProfile } = useProfile();
  return { isPro: hasFullAccess(activeProfile) };
}

/**
 * Whether the current user may use `key`. Ask this rather than checking the
 * plan directly, so a feature moves between tiers by editing FEATURES above
 * and nothing else.
 */
export function useFeature(key) {
  const { isPro } = useProStatus();
  const free = isFreeFeature(key);
  return { allowed: free || isPro, isPro, free, label: featureLabel(key) };
}

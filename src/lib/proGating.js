import { useProfile } from '@/context/ProfileContext';
import { hasFullAccess } from '@/lib/trialUtils';

// Pro features list — used across the app for gating
export const PRO_FEATURES = [
  'ai_coach',
  'tsp_vs_private',
  'tax_estimator',
  'fire_calculator',
  'spouse_combiner',
  'news_alerts',
  'contribution_timeline',
  'advanced_fund_history',
  'fitness_score',
  'smart_rebalancing',
];

// Pro is unlocked for a paid plan or an active (unexpired) trial — same rule
// PaywallScreen already uses to decide whether to show itself.
export function useProStatus() {
  const { activeProfile } = useProfile();
  const isPro = hasFullAccess(activeProfile);
  return { isPro };
}
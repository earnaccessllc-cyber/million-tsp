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

// For now, all users are on the free tier. 
// To unlock Pro, set isPro = true (can be tied to a payment system later).
export function useProStatus() {
  // TODO: tie to payments / user role
  const isPro = true;
  return { isPro };
}
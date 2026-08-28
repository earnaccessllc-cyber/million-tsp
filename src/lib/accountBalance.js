/**
 * The one definition of "the account balance".
 *
 * This existed in three different forms, and they disagreed:
 *
 *   Dashboard / Retirement — total_balance_manual, falling back to funds + MFW.
 *   Analytics / AI Coach   — the selected funds summed, and nothing else.
 *
 * The second form leaves out the Mutual Fund Window entirely and ignores the
 * confirmed total, so every projection on the Analytics tab — contribution
 * optimizer, fitness score, inflation — ran against an account materially
 * smaller than the one the dashboard showed. With a ~14% MFW position that is
 * tens of thousands of dollars of retirement projection, silently missing.
 *
 * Everything that needs the balance now asks here, so the figure a user sees on
 * the home screen is the figure every calculation uses.
 */

/**
 * @param profile  the tsp_profiles row
 * @param funds    fund_allocations rows (selected or not; filtered here)
 * @returns the whole account in dollars: TSP funds plus the MFW window
 */
export function getAccountBalance(profile, funds = []) {
  // total_balance_manual is the grand total — MFW is already inside it — and it
  // is what the nightly price job writes and what the user confirms against
  // tsp.gov. When it's set, it is the answer; nothing should re-derive around it.
  const manual = Number(profile?.total_balance_manual) || 0;
  if (manual > 0) return manual;

  const mfwBalance = profile?.has_mfw ? (Number(profile?.mfw_balance) || 0) : 0;
  const fundsBalance = (funds || [])
    .filter((f) => f.is_selected)
    .reduce((sum, f) => sum + (Number(f.balance) || 0), 0);

  // Only reached before the first confirmed balance: a new profile that has
  // entered allocations, or one that has only entered an opening balance.
  if (fundsBalance > 0) return fundsBalance + mfwBalance;
  return (Number(profile?.opening_balance) || 0) + mfwBalance;
}

/**
 * The TSP-funds-only figure, for the places that genuinely mean "invested in
 * the TSP funds" rather than "the whole account" — a per-fund allocation
 * breakdown, for instance. Separate function so choosing it is deliberate
 * rather than the accidental result of summing whatever was to hand.
 */
export function getFundsOnlyBalance(funds = []) {
  return (funds || [])
    .filter((f) => f.is_selected)
    .reduce((sum, f) => sum + (Number(f.balance) || 0), 0);
}

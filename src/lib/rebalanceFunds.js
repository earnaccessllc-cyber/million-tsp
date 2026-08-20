import { base44 } from '@/api/base44Client';

// Reconciles each selected fund's dollar balance (and share count) with a newly
// manually-entered total balance, whenever the user edits Current Balance or MFW
// holdings. Without this, per-fund balances shown on the Funds page freeze at
// whatever was last computed and drift out of sync with the new total.
//
// Scales every fund's EXISTING balance proportionally so they sum to the new
// total — this preserves the real (possibly drifted) ratio between funds. It
// must never reset each fund to allocation_percent x total: that erases any
// real difference in performance between funds sharing an allocation%
// (confirmed against a real TSP statement — this exact bug had driven two
// different funds to an identical dollar balance). allocation_percent only
// ever decides where NEW contributions get invested, never how an existing
// balance is redistributed. Falling back to allocation% here is only correct
// when there's no existing balance yet to scale from (e.g. first-time setup).
export async function rebalanceFundAllocations(profileId, nonMfwTotal) {
    if (!profileId) return;
    const allocations = await base44.entities.FundAllocation.filter({ profile_id: profileId });
    const selected = allocations.filter(a => a.is_selected);
    const target = Math.max(0, nonMfwTotal || 0);
    const currentTotal = selected.reduce((s, a) => s + (a.balance || a.dollar_balance || 0), 0);
    const scale = currentTotal > 0 ? target / currentTotal : 0;

    await Promise.all(selected.map(a => {
          const currentBal = a.balance || a.dollar_balance || 0;
          const newBalance = currentTotal > 0
            ? currentBal * scale
            : target * ((parseFloat(a.allocation_percent) || 0) / 100);
          const newShares = a.share_price > 0 ? newBalance / a.share_price : a.shares;
          return base44.entities.FundAllocation.update(a.id, {
                  balance: newBalance,
                  dollar_balance: newBalance,
                  shares: newShares,
          });
    }));
}

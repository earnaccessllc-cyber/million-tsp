import { base44 } from '@/api/base44Client';

// Keeps each selected fund's dollar balance (and share count) proportional to its saved
// allocation_percent whenever the profile's total balance or MFW amount changes. Without
// this, per-fund balances shown on the Funds page freeze at whatever was computed during
// initial account setup and drift out of sync with the Current Balance / MFW figures.
export async function rebalanceFundAllocations(profileId, nonMfwTotal) {
    if (!profileId) return;
    const allocations = await base44.entities.FundAllocation.filter({ profile_id: profileId });
    const total = Math.max(0, nonMfwTotal || 0);
    await Promise.all(allocations.map(a => {
          if (!a.is_selected) return null;
          const pct = parseFloat(a.allocation_percent) || 0;
          const newBalance = total > 0 ? total * (pct / 100) : 0;
          const newShares = a.share_price > 0 ? newBalance / a.share_price : a.shares;
          return base44.entities.FundAllocation.update(a.id, {
                  balance: newBalance,
                  dollar_balance: newBalance,
                  shares: newShares,
          });
    }));
}

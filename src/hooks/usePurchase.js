import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { base44 } from '@/api/base44Client';
import { isNative, purchaseLifetime } from '@/lib/purchases';
import { useCheckout } from '@/hooks/useCheckout';

// Drop-in replacement for useCheckout with the same { startCheckout, loading,
// error } shape, so PaywallScreen / ProGate / UpgradePrompt don't need to
// change how they call it — just which hook they import.
//
// On native (iOS/Android) this runs the real Apple/Google In-App Purchase
// via RevenueCat, which Apple requires for unlocking in-app digital
// features. On web it falls back to the existing Stripe checkout unchanged.
//
// Access is granted client-side here, right after RevenueCat confirms the
// entitlement is active (which itself only happens after Apple/Google
// validate the purchase) — simple and enough for now. A RevenueCat webhook
// into a Supabase function (mirroring how stripeWebhook already works for
// the web flow) would be the more tamper-resistant long-term setup.
export function usePurchase() {
  const webCheckout = useCheckout();
  const { activeProfile, refreshProfiles } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isNative()) return webCheckout;

  const startCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const { success, reason } = await purchaseLifetime();
      if (!success) {
        if (reason !== 'cancelled') setError(reason || 'Purchase could not be completed.');
        return;
      }
      if (activeProfile) {
        await base44.entities.TSPProfile.update(activeProfile.id, { plan: 'paid' });
        await refreshProfiles();
      }
    } catch (e) {
      setError(e.message || 'Purchase could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}

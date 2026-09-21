import { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/lib/AuthContext';
import { isNative, purchaseLifetime, claimPurchase } from '@/lib/purchases';
import { useCheckout } from '@/hooks/useCheckout';

// Drop-in replacement for useCheckout with the same { startCheckout, loading,
// error } shape, so PaywallScreen / ProGate / UpgradePrompt don't need to
// change how they call it — just which hook they import.
//
// On native (iOS/Android) this runs the real Apple/Google In-App Purchase
// via RevenueCat, which Apple requires for unlocking in-app digital
// features. On web it falls back to the existing Stripe checkout unchanged.
//
// Access is granted server-side: once RevenueCat reports the entitlement
// active locally, claimPurchase() calls the verifyPurchase edge function,
// which re-checks it against RevenueCat's REST API and flips the profile to
// plan='paid' with the service role (mirroring how stripeWebhook works for
// the web flow). The client can't write plan='paid' itself (migration 0012).
export function usePurchase() {
  const webCheckout = useCheckout();
  const { refreshProfiles } = useProfile();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isNative()) return webCheckout;

  const startCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const { success, reason } = await purchaseLifetime(user?.id);
      if (!success) {
        if (reason !== 'cancelled') setError(reason || 'Purchase could not be completed.');
        return;
      }
      const granted = await claimPurchase();
      if (!granted) {
        setError('Purchase completed but access could not be confirmed. Please tap Restore Purchases or contact support.');
        return;
      }
      await refreshProfiles();
    } catch (e) {
      setError(e.message || 'Purchase could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}

import { useState } from 'react';
import { base44 } from '@/api/base44Client';

// Shared by every "Get Lifetime Access" button (PaywallScreen, ProGate,
// UpgradePrompt) — starts a Stripe Checkout session and redirects to it.
// Access is only actually granted later, by stripeWebhook confirming payment.
export function useCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await base44.functions.invoke('createCheckoutSession', {});
      const payload = result?.data ?? result;
      if (payload?.url) {
        window.location.href = payload.url;
      } else {
        setError(payload?.error || 'Could not start checkout. Please try again.');
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || 'Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  return { startCheckout, loading, error };
}

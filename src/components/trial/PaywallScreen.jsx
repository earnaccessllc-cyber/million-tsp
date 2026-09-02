import React from 'react';
import { CheckCircle, Zap, Shield, Target, TrendingUp, Calendar, Clock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePurchase } from '@/hooks/usePurchase';
import { isNative, restorePurchases } from '@/lib/purchases';

const PRO_FEATURES = [
  { icon: Calendar, text: 'Retirement countdown & eligibility' },
  { icon: TrendingUp, text: 'Full daily balance history & YTD activity' },
  { icon: Shield, text: 'Sick leave credits & pension calculator' },
  { icon: Zap, text: 'TSP loan, FIRE calculator & income timeline' },
  { icon: Target, text: 'Contribution optimizer, risk scoring & fund analytics' },
  { icon: Clock, text: 'AI TSP coach, tax estimator & smart rebalancing' },
];

export default function PaywallScreen({ onContinueFree }) {
  const { startCheckout, loading, error } = usePurchase();
  const [restoring, setRestoring] = React.useState(false);
  const [restoreMessage, setRestoreMessage] = React.useState('');

  const handleRestore = async () => {
    setRestoring(true);
    setRestoreMessage('');
    const { success, reason } = await restorePurchases();
    setRestoreMessage(success ? 'Purchase restored — welcome back!' : (reason || 'Restore failed.'));
    setRestoring(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: '#08080a' }}
    >
      <div className="max-w-md mx-auto px-5 py-8 pb-16">
        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(201,168,50,0.15)', border: '1px solid rgba(201,168,50,0.3)' }}
          >
            <Zap className="w-8 h-8" style={{ color: '#C9A832' }} />
          </div>
          <h1
            style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}
          >
            Upgrade to MillionTSP Pro
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: '#C9A832', fontWeight: 600 }}>
            One time payment. Lifetime access. Never pay again.
          </p>
        </div>

        {/* Price callout */}
        <div
          className="rounded-2xl p-5 mb-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(201,168,50,0.12), rgba(201,168,50,0.05))',
            border: '2px solid rgba(201,168,50,0.4)',
          }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Lifetime Pro Access</p>
          <p
            style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 52, fontWeight: 900, color: '#FFD700', lineHeight: 1 }}
          >
            $19.99
          </p>
          <p className="text-xs text-muted-foreground mt-1">one-time · no subscription · forever</p>
        </div>

        {/* Features */}
        <div
          className="rounded-xl p-4 mb-5"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Everything included in Pro</p>
          <div className="space-y-2.5">
            {PRO_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A832' }} />
                <span className="text-sm text-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor comparison */}
        <div
          className="rounded-xl px-4 py-3 mb-5 text-center"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            💡 <span className="text-foreground font-medium">DailyTSP charges $25 for less features.</span><br />
            We charge <span style={{ color: '#FFD700', fontWeight: 700 }}>$19.99</span> for more.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={startCheckout}
          disabled={loading}
          className="w-full py-4 rounded-xl font-bold text-base tracking-wide mb-3 flex items-center justify-center gap-2 disabled:opacity-70"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)',
            color: '#000',
            boxShadow: '0 4px 20px rgba(201,168,50,0.4)',
            fontFamily: "'Exo 2',sans-serif",
            fontSize: 16,
          }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Starting checkout…' : 'Get Lifetime Access — $19.99'}
        </button>
        {error && <p className="text-center text-xs mb-3" style={{ color: '#f87171' }}>{error}</p>}

        {/* Continue free */}
        <button
          onClick={onContinueFree}
          className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Continue with Free Plan (limited access)
        </button>

        {/* Restore Purchases — native only; required by Apple for a paid unlock */}
        {isNative() && (
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {restoring ? 'Restoring…' : 'Restore Purchases'}
          </button>
        )}
        {restoreMessage && (
          <p className="text-center text-xs mt-1" style={{ color: '#C9A832' }}>{restoreMessage}</p>
        )}

        <p className="text-center text-xs text-muted-foreground mt-4 opacity-50">
          Secure one-time payment. No hidden fees. No recurring charges.
        </p>
      </div>
    </motion.div>
  );
}
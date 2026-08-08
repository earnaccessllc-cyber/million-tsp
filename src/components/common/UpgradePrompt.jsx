import React from 'react';
import { Lock } from 'lucide-react';

export default function UpgradePrompt({ feature = 'this feature' }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center rounded-xl border border-border bg-card gap-4">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(201,168,50,0.12)', border: '1px solid rgba(201,168,50,0.3)' }}>
        <Lock className="w-6 h-6" style={{ color: '#C9A832' }} />
      </div>
      <div>
        <h3 className="font-bold text-base mb-1">MillionTSP Pro Feature</h3>
        <p className="text-sm text-muted-foreground">
          {feature} is included in Pro. Upgrade once for lifetime access — no subscription, no recurring fees.
        </p>
      </div>
      <div className="w-full px-2">
        <button
          className="w-full px-6 py-3 rounded-xl text-sm font-bold tracking-wide"
          style={{ background: 'linear-gradient(135deg, #FFD700, #C9A832)', color: '#0a0a0a' }}
        >
          Get Lifetime Access — $14.99
        </button>
      </div>
      <p className="text-xs text-muted-foreground opacity-70">One-time payment · Never pay again</p>
    </div>
  );
}
import React from 'react';
import { Lock, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeature, featureLabel, PLAN_NAME } from '@/lib/proGating';
import { usePurchase } from '@/hooks/usePurchase';

export default function ProGate({ feature, children }) {
  const { allowed } = useFeature(feature);
  const { startCheckout, loading, error } = usePurchase();
  if (allowed) return children;

  return (
    <div className="relative flex flex-col items-center justify-center p-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 text-center gap-2">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-4 h-4 text-primary" />
      </div>
      <div>
        <div className="flex items-center justify-center gap-1 mb-0.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary">{PLAN_NAME}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {featureLabel(feature)} is included in {PLAN_NAME}. One-time payment, lifetime access.
        </p>
      </div>
      <Button size="sm" className="gap-2" onClick={startCheckout} disabled={loading}>
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? 'Starting checkout…' : `Upgrade to ${PLAN_NAME}`}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
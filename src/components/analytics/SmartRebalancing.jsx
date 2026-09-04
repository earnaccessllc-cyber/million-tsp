import React, { useState } from 'react';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';

const DEFAULT_TARGETS = {
  'C Fund': 40, 'S Fund': 20, 'I Fund': 15, 'G Fund': 15, 'F Fund': 10,
};

export default function SmartRebalancing({ profile, funds }) {
  const { isPro, loading: planLoading } = useProStatus();
  const [targets, setTargets] = useState({});

  // Nothing at all until the plan is known — showing the gate first would
  // flash an upsell at a trial or paid user on every mount.
  if (planLoading) return null;
  if (!isPro) return <ProGate feature="smart_rebalancing" />;

  if (!funds || funds.length === 0) {
    return <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">Select funds to see rebalancing suggestions.</div>;
  }

  const DRIFT_THRESHOLD = 5;

  const fundsWithDrift = funds.map(f => {
    const target = targets[f.fund_name] ?? DEFAULT_TARGETS[f.fund_name] ?? null;
    const current = f.allocation_percent || 0;
    const drift = target !== null ? current - target : null;
    return { ...f, target, current, drift };
  });

  const driftFunds = fundsWithDrift.filter(f => f.drift !== null && Math.abs(f.drift) > DRIFT_THRESHOLD);
  const needsRebalance = driftFunds.length > 0;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Smart Rebalancing</h3>
      </div>

      {needsRebalance && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300">{driftFunds.length} fund{driftFunds.length > 1 ? 's have' : ' has'} drifted more than {DRIFT_THRESHOLD}% from target. Consider rebalancing.</p>
        </div>
      )}

      {!needsRebalance && funds.length > 0 && (
        <div className="bg-gain/10 border border-gain/20 rounded-xl p-3">
          <p className="text-xs text-gain font-semibold">✓ Portfolio is within target ranges. No rebalancing needed.</p>
        </div>
      )}

      <div className="space-y-2">
        {fundsWithDrift.map(f => (
          <div key={f.id} className={`p-3 rounded-xl ${f.drift !== null && Math.abs(f.drift) > DRIFT_THRESHOLD ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-muted'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{f.fund_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Current: <span className="font-semibold text-foreground">{f.current}%</span></span>
                {f.target !== null && <span className="text-xs text-muted-foreground">Target: <span className="font-semibold text-foreground">{f.target}%</span></span>}
              </div>
            </div>
            {f.drift !== null && Math.abs(f.drift) > DRIFT_THRESHOLD && (
              <p className={`text-xs font-medium ${f.drift > 0 ? 'text-yellow-400' : 'text-primary'}`}>
                {f.drift > 0 ? `↓ Reduce by ${f.drift.toFixed(1)}%` : `↑ Increase by ${Math.abs(f.drift).toFixed(1)}%`} via interfund transfer
              </p>
            )}
          </div>
        ))}
      </div>

      <a
        href="https://www.tsp.gov/fund-performance/share-price-history/"
        target="_blank" rel="noreferrer"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <ExternalLink className="w-3 h-3" />Do interfund transfer on TSP.gov
      </a>
    </div>
  );
}
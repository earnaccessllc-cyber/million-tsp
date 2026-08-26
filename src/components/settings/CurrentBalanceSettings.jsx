import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, ExternalLink, DollarSign } from 'lucide-react';
import MFWHoldingsTracker from '@/components/settings/MFWHoldingsTracker';
import { rebalanceFundAllocations } from '@/lib/rebalanceFunds';
import { formatUpdatedAt, localDateString } from '@/lib/balanceUpdatedAt';

export default function CurrentBalanceSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const [totalBalance, setTotalBalance] = useState(activeProfile?.total_balance_manual ?? '');
  const [hasMfw, setHasMfw] = useState(activeProfile?.has_mfw ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Capture install date on first use — stored permanently, never changes
  useEffect(() => {
    if (activeProfile?.id && !activeProfile?.balance_install_date) {
      const today = new Date().toISOString().split('T')[0];
      base44.entities.TSPProfile.update(activeProfile.id, { balance_install_date: today });
    }
  }, [activeProfile?.id]);

  // Tab pages stay mounted (never unmount) when switching tabs in this app, so this must
  // re-sync whenever the profile's real balance changes — not just once on first mount —
  // otherwise this input freezes at whatever value was loaded the first time this page was visited.
  useEffect(() => {
    setTotalBalance(activeProfile?.total_balance_manual ?? '');
    setHasMfw(activeProfile?.has_mfw ?? false);
  }, [activeProfile?.id, activeProfile?.total_balance_manual, activeProfile?.has_mfw]);

  const handleSave = async () => {
    if (!activeProfile?.id) return;
    setSaving(true);
    await base44.entities.TSPProfile.update(activeProfile.id, {
      total_balance_manual: parseFloat(totalBalance) || 0,
      // Local date, not UTC: toISOString() rolls over during the evening for US
      // users and would stamp the balance with tomorrow's market day.
      balance_last_confirmed: localDateString(),
      balance_last_confirmed_at: new Date().toISOString(),
      has_mfw: hasMfw,
      ...(!hasMfw ? { mfw_balance: 0, mfw_holdings: [] } : {}),
    });
    await rebalanceFundAllocations(activeProfile.id, (parseFloat(totalBalance) || 0) - (hasMfw ? (activeProfile.mfw_balance || 0) : 0));
    await refreshProfiles();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (!activeProfile) return null;

  // Show the last time the balance was actually confirmed/updated (manual save, nightly job,
  // or allocation save) — not balance_install_date, which is a one-time timestamp frozen from
  // the day the account was first set up and never reflects how current the balance really is.
  const lastConfirmedLabel = formatUpdatedAt(activeProfile?.balance_last_confirmed_at, activeProfile?.balance_last_confirmed, { long: true })
    || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="rounded-xl border-2 border-primary/40 bg-primary/5 overflow-hidden">
      {/* Header banner */}
      <div className="px-4 py-3 bg-primary/10 border-b border-primary/20 flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Current TSP Balance</p>
          <p className="text-[10px] text-muted-foreground">as of {lastConfirmedLabel} · used for all calculations</p>
        </div>
        <a
          href="https://www.tsp.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary flex items-center gap-0.5 hover:underline flex-shrink-0"
        >
          TSP.gov <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      <div className="p-4 space-y-4">
        {/* Main balance input */}
        <div>
          <Label className="text-xs font-semibold text-foreground mb-1.5 block">
            💰 Current TSP Balance <span className="text-primary">(Required)</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground text-lg font-bold">$</span>
            <Input
              type="number"
              value={totalBalance}
              onChange={e => { setTotalBalance(e.target.value); setSaved(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              className="pl-7 h-14 text-2xl font-bold border-primary/30 focus:border-primary bg-background"
              placeholder="0.00"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Enter your total TSP balance from TSP.gov or your latest statement
          </p>
        </div>

        {/* MFW toggle */}
        <div>
          <Label className="text-xs font-semibold text-foreground mb-1.5 block">Mutual Fund Window (MFW)</Label>
          <div className="flex gap-2 mb-3">
            {[true, false].map(val => (
              <button
                key={String(val)}
                onClick={() => setHasMfw(val)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  hasMfw === val
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 border-border text-muted-foreground'
                }`}
              >
                {val ? 'Yes, I have MFW' : 'No MFW'}
              </button>
            ))}
          </div>

          {hasMfw && (
            <MFWHoldingsTracker profile={activeProfile} onSaved={refreshProfiles} />
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full h-11 text-base font-bold gap-2">
          {saved
            ? <><CheckCircle2 className="w-4 h-4" /> ✅ Balance updated!</>
            : saving ? 'Saving…' : 'Save Balance'
          }
        </Button>
      </div>
    </div>
  );
}

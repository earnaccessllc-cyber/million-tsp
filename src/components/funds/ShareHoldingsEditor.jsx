import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ALL_FUNDS, formatCurrency } from '@/lib/tspFunds';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, CheckSquare, Square, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { useQueryClient } from '@tanstack/react-query';

const FUND_COLORS = {
  'G Fund': '#22c55e', 'F Fund': '#eab308', 'C Fund': '#06b6d4',
  'S Fund': '#f97316', 'I Fund': '#8b5cf6',
};
const LIFECYCLE_COLOR = '#C9A832';

// Share-based tracking — the model TSP itself uses. You own a share count in
// each fund; the balance is shares x that day's share price. Share counts change
// only when money actually moves (contributions, loan repayments, interfund
// transfers), so allocations drift as funds diverge, exactly like the real
// account. Enter the share counts straight off your TSP.gov statement.
export default function ShareHoldingsEditor({ profileId, funds, onSaved }) {
  const { toast } = useToast();
  const { activeProfile, refreshProfiles } = useProfile();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [rows, setRows] = useState(() =>
    ALL_FUNDS.map(f => {
      const existing = funds.find(a => a.fund_name === f.name);
      return {
        fund_name: f.name,
        fund_type: f.key.startsWith('L') ? 'lifecycle' : 'core',
        is_selected: existing?.is_selected ?? false,
        shares: existing?.shares != null ? String(existing.shares) : '',
        share_price: existing?.share_price ?? 0,
        id: existing?.id ?? null,
      };
    })
  );

  const mfwBal = activeProfile?.has_mfw ? (activeProfile?.mfw_balance || 0) : 0;

  const valueOf = (r) => (parseFloat(r.shares) || 0) * (r.share_price || 0);
  const fundsTotal = rows.filter(r => r.is_selected).reduce((s, r) => s + valueOf(r), 0);
  const grandTotal = fundsTotal + mfwBal;

  const setShares = (fund_name, val) =>
    setRows(prev => prev.map(r => r.fund_name === fund_name ? { ...r, shares: val } : r));

  const toggle = (fund_name) =>
    setRows(prev => prev.map(r => r.fund_name === fund_name ? { ...r, is_selected: !r.is_selected } : r));

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg('');

    for (const r of rows) {
      const shares = r.is_selected ? (parseFloat(r.shares) || 0) : 0;
      const balance = shares * (r.share_price || 0);
      const payload = {
        profile_id: profileId,
        fund_name: r.fund_name,
        fund_type: r.fund_type,
        is_selected: r.is_selected,
        shares,
        balance,
        dollar_balance: balance,
        share_price: r.share_price || 0,
      };
      if (r.id) {
        await base44.entities.FundAllocation.update(r.id, payload);
      } else {
        const created = await base44.entities.FundAllocation.create(payload);
        setRows(prev => prev.map(x => x.fund_name === r.fund_name ? { ...x, id: created.id } : x));
      }
    }

    // The total is now genuinely derived from independent inputs (share counts
    // and published prices) rather than from itself, so writing it back is safe.
    await base44.entities.TSPProfile.update(profileId, {
      total_balance_manual: grandTotal,
      balance_last_confirmed: new Date().toISOString().split('T')[0],
    });

    await refreshProfiles();
    queryClient.invalidateQueries({ queryKey: ['fund-allocations', profileId] });
    setSaving(false);
    setSavedMsg(`Balance set from share counts: ${formatCurrency(grandTotal)}`);
    toast({ title: 'Share holdings saved', description: 'Balance recalculated from shares × share price.' });
    onSaved?.();
  };

  const coreRows = rows.filter(r => r.fund_type === 'core');
  const lifecycleRows = rows.filter(r => r.fund_type === 'lifecycle');

  const Row = ({ r }) => (
    <div className={`px-3 py-2.5 ${r.is_selected ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-2">
        <button onClick={() => toggle(r.fund_name)} className="flex-shrink-0">
          {r.is_selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted-foreground" />}
        </button>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: FUND_COLORS[r.fund_name] || LIFECYCLE_COLOR }} />
        <span className="text-xs font-medium flex-1 text-foreground">{r.fund_name}</span>
        {r.is_selected && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.0001"
              value={r.shares}
              onChange={e => setShares(r.fund_name, e.target.value)}
              className="h-7 w-28 text-xs text-right px-2"
              placeholder="0.0000"
            />
            <span className="text-[10px] text-muted-foreground w-8">sh</span>
          </div>
        )}
      </div>
      {r.is_selected && (
        <div className="flex items-center gap-3 mt-1.5 pl-8">
          <span className="text-[10px] text-muted-foreground">
            @ {r.share_price ? `$${Number(r.share_price).toFixed(4)}` : 'price pending'}
          </span>
          <span className="text-[10px] font-semibold text-foreground ml-auto">
            {formatCurrency(valueOf(r))}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border">
        <span className="text-xs font-semibold">My Share Holdings</span>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Enter the share count for each fund from your TSP.gov statement. Your balance is
          calculated as shares × the published share price.
        </p>
      </div>

      <div className="divide-y divide-border">
        <div className="px-3 py-1.5 bg-secondary/30">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Core Funds</span>
        </div>
        {coreRows.map(r => <Row key={r.fund_name} r={r} />)}
      </div>

      <div className="divide-y divide-border border-t border-border">
        <div className="px-3 py-1.5 bg-secondary/30">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lifecycle Funds</span>
        </div>
        {lifecycleRows.map(r => <Row key={r.fund_name} r={r} />)}
      </div>

      <div className="px-3 py-2.5 border-t border-border space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">TSP funds</span>
          <span className="font-semibold text-foreground">{formatCurrency(fundsTotal)}</span>
        </div>
        {mfwBal > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">+ MFW</span>
            <span className="font-semibold text-primary">{formatCurrency(mfwBal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs border-t border-border pt-1 mt-1">
          <span className="font-bold text-foreground">Total</span>
          <span className="font-black text-foreground">{formatCurrency(grandTotal)}</span>
        </div>
      </div>

      <div className="p-3 border-t border-border space-y-2">
        {savedMsg && (
          <div className="flex items-center gap-1.5 text-[10px] text-gain bg-gain/10 rounded-lg px-3 py-2">
            <CheckCircle className="w-3 h-3 flex-shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Saving…' : 'Save Share Holdings'}
        </Button>
      </div>
    </div>
  );
}

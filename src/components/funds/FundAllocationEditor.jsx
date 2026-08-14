import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ALL_FUNDS } from '@/lib/tspFunds';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, CheckSquare, Square, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useProfile } from '@/context/ProfileContext';
import { fetchLivePricesSheet } from '@/functions/fetchLivePricesSheet';
import { useQueryClient } from '@tanstack/react-query';

const FUND_COLORS = {
  'G Fund': '#22c55e', 'F Fund': '#eab308', 'C Fund': '#06b6d4',
  'S Fund': '#f97316', 'I Fund': '#8b5cf6',
};
const LIFECYCLE_COLOR = '#C9A832';

// Map fund_name (entity, e.g. 'L 2030' with a space) to the live sheet's raw name (e.g. 'L2030', no space)
const FUND_NAME_TO_SHEET = {
  'G Fund': 'G Fund', 'F Fund': 'F Fund', 'C Fund': 'C Fund', 'S Fund': 'S Fund', 'I Fund': 'I Fund',
  'L Income': 'L Income', 'L 2030': 'L2030', 'L 2035': 'L2035', 'L 2040': 'L2040',
  'L 2045': 'L2045', 'L 2050': 'L2050', 'L 2055': 'L2055', 'L 2060': 'L2060',
  'L 2065': 'L2065', 'L 2070': 'L2070', 'L 2075': 'L2075',
};

export default function FundAllocationEditor({ profileId, funds, onSaved }) {
  const { toast } = useToast();
  const { activeProfile, refreshProfiles } = useProfile();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');

  // Editable MFW percent — initialized from the current MFW balance vs. total balance,
  // but the user can type a new percent here to resize their MFW allocation.
  const [mfwPercentInput, setMfwPercentInput] = useState(() => {
    const bal = activeProfile?.has_mfw ? (activeProfile?.mfw_balance || 0) : 0;
    const tot = activeProfile?.total_balance_manual || 0;
    return bal > 0 && tot > 0 ? ((bal / tot) * 100).toFixed(1) : '';
  });

  const [allocations, setAllocations] = useState(() =>
    ALL_FUNDS.map(f => {
      const existing = funds.find(a => a.fund_name === f.name);
      return {
        fund_name: f.name,
        fund_type: f.key.startsWith('L') ? 'lifecycle' : 'core',
        is_selected: existing?.is_selected ?? false,
        entry_mode: 'percent',
        allocation_percent: existing?.allocation_percent ?? '',
        dollar_value: existing?.dollar_balance ?? '',
        share_price: existing?.share_price ?? '',
        shares: existing?.shares ?? '',
        dollar_balance: existing?.dollar_balance ?? '',
        last_price_update: existing?.last_price_update ?? null,
        id: existing?.id ?? null,
      };
    })
  );

  useEffect(() => {
    setAllocations(prev =>
      prev.map(a => {
        const existing = funds.find(f => f.fund_name === a.fund_name);
        if (!existing) return a;
        return {
          ...a,
          is_selected: existing.is_selected ?? a.is_selected,
          allocation_percent: existing.allocation_percent ?? a.allocation_percent,
          share_price: existing.share_price ?? a.share_price,
          shares: existing.shares ?? a.shares,
          dollar_balance: existing.dollar_balance ?? a.dollar_balance,
          last_price_update: existing.last_price_update ?? a.last_price_update,
          id: existing.id ?? a.id,
        };
      })
    );
  }, [funds]);

  const mfwBal = activeProfile?.has_mfw && activeProfile?.mfw_balance > 0 ? (activeProfile.mfw_balance || 0) : 0;
  const totalManualForPct = activeProfile?.total_balance_manual || 0;
  const nonMfwTotal = Math.max(0, totalManualForPct - mfwBal);
  const mfwActive = activeProfile?.has_mfw && (mfwBal > 0 || parseFloat(mfwPercentInput) > 0);
  const mfwPctDisplay = parseFloat(mfwPercentInput) || 0;
  const totalPct = allocations.filter(a => a.is_selected).reduce((s, a) => s + (parseFloat(a.allocation_percent) || 0), 0) + mfwPctDisplay;

  const toggle = (fund_name) => {
    setAllocations(prev => prev.map(a =>
      a.fund_name === fund_name ? { ...a, is_selected: !a.is_selected } : a
    ));
  };

  const setMode = (fund_name, mode) => {
    setAllocations(prev => prev.map(a =>
      a.fund_name === fund_name ? { ...a, entry_mode: mode } : a
    ));
  };

  const setPct = (fund_name, val) => {
    setAllocations(prev => prev.map(a =>
      a.fund_name === fund_name ? { ...a, allocation_percent: val } : a
    ));
  };

  // Dollar entry back-computes the allocation_percent that's actually persisted —
  // everything downstream (save, daily price updates) still runs on allocation_percent.
  const setDollar = (fund_name, val) => {
    setAllocations(prev => prev.map(a => {
      if (a.fund_name !== fund_name) return a;
      const dollarVal = parseFloat(val) || 0;
      const pct = nonMfwTotal > 0 ? (dollarVal / nonMfwTotal) * 100 : 0;
      return { ...a, dollar_value: val, allocation_percent: pct };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setVerifyMsg('');

    // Optimistic update — immediately reflect toggle/pct changes in fund cache
    const fundKey = ['fund-allocations', profileId];
    const prevFunds = queryClient.getQueryData(fundKey);
    queryClient.setQueryData(fundKey, (old) => {
      if (!old) return old;
      return old.map(f => {
        const local = allocations.find(a => a.fund_name === f.fund_name);
        if (!local) return f;
        return { ...f, is_selected: local.is_selected, allocation_percent: local.allocation_percent };
      });
    });

    const totalManual = activeProfile?.total_balance_manual || 0;
    const oldMfwBal = activeProfile?.has_mfw ? (activeProfile?.mfw_balance || 0) : 0;
    const mfwActiveNow = activeProfile?.has_mfw && (oldMfwBal > 0 || parseFloat(mfwPercentInput) > 0);
    const newMfwBal = mfwActiveNow ? Math.max(0, ((parseFloat(mfwPercentInput) || 0) / 100) * totalManual) : 0;

    // If the MFW percent was changed here, scale the underlying holdings (from Settings →
    // MFW Holdings) proportionally so their dollar totals stay consistent with this percent.
    if (mfwActiveNow && Math.abs(newMfwBal - oldMfwBal) > 0.01) {
      const holdings = Array.isArray(activeProfile?.mfw_holdings) ? activeProfile.mfw_holdings : [];
      const scale = oldMfwBal > 0 ? newMfwBal / oldMfwBal : 0;
      const scaledHoldings = holdings.map(h => {
        const price = h.last_price || 0;
        if (h.entry_mode === 'dollar') {
          const newDollar = (parseFloat(h.dollar_value) || 0) * scale;
          return { ...h, dollar_value: newDollar, shares: price > 0 ? newDollar / price : h.shares };
        }
        const newShares = (parseFloat(h.shares) || 0) * scale;
        return { ...h, shares: newShares, dollar_value: price > 0 ? price * newShares : h.dollar_value };
      });
      await base44.entities.TSPProfile.update(activeProfile.id, {
        mfw_holdings: scaledHoldings,
        mfw_balance: newMfwBal,
      });
    }

    const nonMfwTotal = Math.max(0, totalManual - newMfwBal);

    // Step 1: Fetch current closing prices from Google Sheet
    let livePrices = {};
    try {
      const res = await fetchLivePricesSheet({});
      const sheetFunds = res.data?.funds || [];
      for (const f of sheetFunds) {
        livePrices[f.fund_name] = f;
      }
    } catch (e) {
      // If sheet fetch fails, fall back to stored prices
    }

    let verifiedTotal = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const a of allocations) {
      const allocPct = (parseFloat(a.allocation_percent) || 0) / 100;

      // Get closing price from sheet or fallback to stored
      const sheetKey = FUND_NAME_TO_SHEET[a.fund_name];
      const sheetEntry = livePrices[sheetKey];
      const closingPrice = sheetEntry?.share_price ?? a.share_price ?? 0;

      let computedBalance = 0;
      let computedShares = a.shares || 0;

      if (a.is_selected && nonMfwTotal > 0 && allocPct > 0) {
        // Step 1: fund dollar balance = total × allocation %
        computedBalance = nonMfwTotal * allocPct;
        // Step 2: back-calculate shares = balance ÷ closing price
        if (closingPrice > 0) {
          computedShares = computedBalance / closingPrice;
        }
        verifiedTotal += computedBalance;
      } else if (!a.is_selected) {
        computedBalance = 0;
        computedShares = 0;
      } else {
        computedBalance = a.dollar_balance || 0;
        computedShares = a.shares || 0;
      }

      const payload = {
        profile_id: profileId,
        fund_name: a.fund_name,
        fund_type: a.fund_type,
        is_selected: a.is_selected,
        allocation_percent: parseFloat(a.allocation_percent) || 0,
        balance: computedBalance,
        dollar_balance: computedBalance,
        shares: computedShares,
        share_price: closingPrice || a.share_price || 0,
        last_price_update: today,
      };

      if (a.id) {
        await base44.entities.FundAllocation.update(a.id, payload);
      } else {
        const created = await base44.entities.FundAllocation.create(payload);
        setAllocations(prev => prev.map(x => x.fund_name === a.fund_name ? { ...x, id: created.id } : x));
      }
    }

    setSaving(false);

    // Invalidate so real data refreshes after optimistic update
    queryClient.invalidateQueries({ queryKey: fundKey });

    // Step 3: Verify — report how the split adds up, but never write it back as
    // the current balance.
    //
    // Fund balances here are derived FROM the total (nonMfwTotal × each
    // allocation %), not measured independently — no price data feeds into
    // them. So verifiedTotal is just nonMfwTotal × (sum of percentages).
    // Writing verifiedTotal + newMfwBal back over total_balance_manual therefore
    // can never add information, and whenever the percentages don't sum to
    // exactly 100% it silently shrinks the balance by the shortfall. Saving
    // repeatedly compounded that, ratcheting the total down until only the MFW
    // portion was left. The user-entered total is the source of truth; it is
    // only ever changed from the balance fields the user actually edits (and
    // from the MFW percent above, which resizes MFW within that same total).
    const grandTotal = verifiedTotal + newMfwBal;
    const diff = Math.abs(grandTotal - totalManual);
    if (verifiedTotal > 0) {
      setVerifyMsg(diff < 1
        ? `✅ Shares calculated. Allocations account for the full balance: $${totalManual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `⚠️ Shares calculated, but your fund percentages only account for $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of your $${totalManual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} balance. Check that your percentages total 100%. Your balance was left unchanged.`);
    }

    toast({ title: 'Fund allocations saved', description: 'Shares back-calculated from closing prices.' });
    onSaved?.();
  };

  const coreFunds = allocations.filter(a => a.fund_type === 'core');
  const lifecycleFunds = allocations.filter(a => a.fund_type === 'lifecycle');

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold">My Fund Allocations</span>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {totalPct.toFixed(1)}%
        </span>
      </div>

      {/* Core Funds */}
      <div className="divide-y divide-border">
        <div className="px-3 py-1.5 bg-secondary/30">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Core Funds</span>
        </div>
        {coreFunds.map(a => (
          <FundRow key={a.fund_name} a={a} onToggle={toggle} onSetPct={setPct} onSetDollar={setDollar} onSetMode={setMode} nonMfwTotal={nonMfwTotal} />
        ))}
      </div>

      {/* Lifecycle Funds */}
      <div className="divide-y divide-border border-t border-border">
        <div className="px-3 py-1.5 bg-secondary/30">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Lifecycle Funds</span>
        </div>
        {lifecycleFunds.map(a => (
          <FundRow key={a.fund_name} a={a} onToggle={toggle} onSetPct={setPct} onSetDollar={setDollar} onSetMode={setMode} nonMfwTotal={nonMfwTotal} />
        ))}
      </div>

      {/* MFW Row — shown when MFW is active. Percent is editable here and drives the
          underlying holdings in Settings → MFW Holdings once saved. */}
      {mfwActive && (
        <div className="divide-y divide-border border-t border-border">
          <div className="px-3 py-1.5 bg-secondary/30">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Mutual Fund Window</span>
          </div>
          <div className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 flex-shrink-0" /> {/* spacer for checkbox column */}
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#C9A832' }} />
              <span className="text-xs font-medium flex-1">MFW (Mutual Fund Window)</span>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={mfwPercentInput}
                  onChange={e => setMfwPercentInput(e.target.value)}
                  className="h-7 w-16 text-xs text-right px-2"
                  placeholder=""
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1.5 pl-8">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">≈</span>
                <span className="text-[10px] font-semibold text-foreground">
                  ${(((parseFloat(mfwPercentInput) || 0) / 100) * totalManualForPct).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">Ticker(s) managed in Settings → Balance</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-border space-y-2">
        {verifyMsg && (
          <div className="flex items-center gap-1.5 text-[10px] text-gain bg-gain/10 rounded-lg px-3 py-2">
            <CheckCircle className="w-3 h-3 flex-shrink-0" />
            <span>{verifyMsg}</span>
          </div>
        )}
        <Button onClick={handleSave} disabled={saving} size="sm" className="w-full">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? 'Calculating shares…' : 'Save Allocations & Calculate Shares'}
        </Button>
      </div>
    </div>
  );
}

function FundRow({ a, onToggle, onSetPct, onSetDollar, onSetMode, nonMfwTotal }) {
  const color = FUND_COLORS[a.fund_name] || LIFECYCLE_COLOR;
  const mode = a.entry_mode || 'percent';
  const impliedDollar = mode === 'percent' && nonMfwTotal > 0 ? (parseFloat(a.allocation_percent) || 0) / 100 * nonMfwTotal : null;
  const impliedPct = mode === 'dollar' ? (parseFloat(a.allocation_percent) || 0) : null;
  return (
    <div className={`px-3 py-2.5 ${a.is_selected ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-2">
        <button onClick={() => onToggle(a.fund_name)} className="flex-shrink-0">
          {a.is_selected
            ? <CheckSquare className="w-4 h-4 text-primary" />
            : <Square className="w-4 h-4 text-muted-foreground" />
          }
        </button>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <span className="text-xs font-medium flex-1 text-foreground">{a.fund_name}</span>

        {a.is_selected && (
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md border border-border overflow-hidden flex-shrink-0">
              <button
                type="button"
                onClick={() => onSetMode(a.fund_name, 'percent')}
                className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${mode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                style={{ minHeight: 'unset' }}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => onSetMode(a.fund_name, 'dollar')}
                className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${mode === 'dollar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                style={{ minHeight: 'unset' }}
              >
                $
              </button>
            </div>
            {mode === 'dollar' ? (
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={a.dollar_value || ''}
                  onChange={e => onSetDollar(a.fund_name, e.target.value)}
                  className="h-7 w-24 text-xs text-right pl-4 pr-2"
                  placeholder="0"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={a.allocation_percent || ''}
                  onChange={e => onSetPct(a.fund_name, e.target.value)}
                  className="h-7 w-16 text-xs text-right px-2"
                  placeholder=""
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {a.is_selected && (impliedDollar != null || impliedPct != null) && (
        <div className="pl-8 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {mode === 'percent'
              ? `≈ $${impliedDollar.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : `≈ ${impliedPct.toFixed(2)}%`}
          </span>
        </div>
      )}

      {a.is_selected && (
        <div className="flex items-center gap-4 mt-1.5 pl-8 flex-wrap">
          {a.dollar_balance > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Balance:</span>
              <span className="text-[10px] font-semibold text-foreground">
                ${a.dollar_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {a.shares > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Shares:</span>
              <span className="text-[10px] font-semibold text-foreground">
                {a.shares.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          {a.last_price_update && (
            <span className="text-[10px] text-muted-foreground ml-auto">updated {a.last_price_update}</span>
          )}
        </div>
      )}
    </div>
  );
}

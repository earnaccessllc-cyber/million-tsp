import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, X, Plus, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/tspFunds';
import { rebalanceFundAllocations } from '@/lib/rebalanceFunds';

async function fetchTickerQuote(ticker) {
  // Yahoo Finance has no CORS headers, so the lookup runs through a backend function.
  const result = await base44.functions.invoke('fetchTickerPrice', { ticker });
  const payload = result?.data ?? result;
  if (payload?.error || !payload?.price) throw new Error(payload?.error || 'No price');
  return payload;
}

export default function MFWHoldingsTracker({ profile, onSaved }) {
  const { refreshProfiles } = useProfile();
  const today = new Date().toISOString().split('T')[0];

  const [holdings, setHoldings] = useState(() => {
    const stored = profile?.mfw_holdings;
    if (Array.isArray(stored) && stored.length > 0) {
      return stored.map(h => ({
        entry_mode: h.entry_mode || 'shares',
        dollar_value: h.dollar_value ?? '',
        loading: false,
        error: null,
        ...h,
      }));
    }
    return [{ ticker: '', shares: '', dollar_value: '', entry_mode: 'shares', last_price: null, last_updated: null, loading: false, error: null }];
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Auto-refresh all prices on mount if has holdings
  useEffect(() => {
    const stored = profile?.mfw_holdings;
    if (!Array.isArray(stored) || stored.length === 0) return;
    refreshAllPrices(stored.map(h => ({ ...h, loading: false, error: null })));
  }, [profile?.id]);

  const refreshAllPrices = async (rows) => {
    setRefreshingAll(true);
    const updated = await Promise.all(
      rows.map(async (h) => {
        if (!h.ticker) return h;
        try {
          const q = await fetchTickerQuote(h.ticker);
          return {
            ...h, last_price: q.price, last_updated: today, error: null,
            daily_change_percent: q.daily_change_percent, week_change_percent: q.week_change_percent,
            month_change_percent: q.month_change_percent, ytd_change_percent: q.ytd_change_percent,
          };
        } catch {
          return { ...h, error: 'Price unavailable' };
        }
      })
    );
    setHoldings(updated);
    setRefreshingAll(false);
  };

  const fetchPriceForRow = async (idx) => {
    const h = holdings[idx];
    if (!h.ticker) return;
    setHoldings(prev => prev.map((r, i) => i === idx ? { ...r, loading: true, error: null } : r));
    try {
      const q = await fetchTickerQuote(h.ticker);
      setHoldings(prev => prev.map((r, i) => i === idx ? {
        ...r, last_price: q.price, last_updated: today, loading: false,
        daily_change_percent: q.daily_change_percent, week_change_percent: q.week_change_percent,
        month_change_percent: q.month_change_percent, ytd_change_percent: q.ytd_change_percent,
      } : r));
    } catch {
      setHoldings(prev => prev.map((r, i) => i === idx ? { ...r, last_price: null, loading: false, error: 'Not found' } : r));
    }
  };

  const updateRow = (idx, field, value) => {
    setHoldings(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    setHoldings(prev => [...prev, { ticker: '', shares: '', dollar_value: '', entry_mode: 'shares', last_price: null, last_updated: null, loading: false, error: null }]);
  };

  const setMode = (idx, mode) => {
    setHoldings(prev => prev.map((r, i) => i === idx ? { ...r, entry_mode: mode } : r));
  };

  const rowValue = (h) => {
    if (h.entry_mode === 'dollar') return parseFloat(h.dollar_value) || 0;
    return (h.last_price || 0) * (parseFloat(h.shares) || 0);
  };

  const removeRow = (idx) => {
    setHoldings(prev => prev.filter((_, i) => i !== idx));
  };

  const mfwTotal = holdings.reduce((sum, h) => sum + rowValue(h), 0);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    const clean = holdings
      .filter(h => h.ticker && (h.entry_mode === 'dollar' ? parseFloat(h.dollar_value) > 0 : parseFloat(h.shares) > 0))
      .map(h => {
        const price = h.last_price || 0;
        const changeFields = {
          daily_change_percent: h.daily_change_percent ?? null,
          week_change_percent: h.week_change_percent ?? null,
          month_change_percent: h.month_change_percent ?? null,
          ytd_change_percent: h.ytd_change_percent ?? null,
        };
        if (h.entry_mode === 'dollar') {
          const dollarValue = parseFloat(h.dollar_value) || 0;
          return {
            ticker: h.ticker.toUpperCase(),
            entry_mode: 'dollar',
            dollar_value: dollarValue,
            shares: price > 0 ? dollarValue / price : (parseFloat(h.shares) || 0),
            last_price: price,
            last_updated: h.last_updated || today,
            ...changeFields,
          };
        }
        const shares = parseFloat(h.shares) || 0;
        return {
          ticker: h.ticker.toUpperCase(),
          entry_mode: 'shares',
          shares,
          dollar_value: price * shares,
          last_price: price,
          last_updated: h.last_updated || today,
          ...changeFields,
        };
      });
    await base44.entities.TSPProfile.update(profile.id, {
      mfw_holdings: clean,
      mfw_balance: mfwTotal,
      has_mfw: true,
      mfw_last_updated: today,
    });
    await rebalanceFundAllocations(profile.id, (profile?.total_balance_manual || 0) - mfwTotal);
    await refreshProfiles();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (onSaved) onSaved();
  };

  return (
    <div className="space-y-3">
      {/* Holdings list */}
      <div className="space-y-2">
        {holdings.map((h, idx) => {
          const value = rowValue(h);
          const mode = h.entry_mode || 'shares';
          const impliedShares = mode === 'dollar' && h.last_price > 0 ? (parseFloat(h.dollar_value) || 0) / h.last_price : null;
          return (
            <div key={idx} className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              <div className="flex gap-2 items-start">
                {/* Ticker */}
                <div className="w-24 flex-shrink-0">
                  <Label className="text-[10px] text-muted-foreground mb-1 block">Ticker</Label>
                  <Input
                    value={h.ticker}
                    maxLength={10}
                    placeholder="VTSAX"
                    className="h-9 text-sm font-bold uppercase"
                    onChange={e => updateRow(idx, 'ticker', e.target.value.toUpperCase())}
                    onBlur={() => fetchPriceForRow(idx)}
                  />
                </div>
                {/* Shares or Dollar amount, toggled by mode */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-[10px] text-muted-foreground">{mode === 'dollar' ? 'Value ($)' : 'Shares'}</Label>
                    <div className="flex rounded-md border border-border overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setMode(idx, 'shares')}
                        className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${mode === 'shares' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                        style={{ minHeight: 'unset' }}
                      >
                        Shares
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode(idx, 'dollar')}
                        className={`px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${mode === 'dollar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                        style={{ minHeight: 'unset' }}
                      >
                        $
                      </button>
                    </div>
                  </div>
                  {mode === 'dollar' ? (
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                      <Input
                        type="number"
                        value={h.dollar_value}
                        placeholder="0.00"
                        className="h-9 text-sm pl-5"
                        onChange={e => updateRow(idx, 'dollar_value', e.target.value)}
                      />
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={h.shares}
                      placeholder="0.00"
                      className="h-9 text-sm"
                      onChange={e => updateRow(idx, 'shares', e.target.value)}
                    />
                  )}
                </div>
                {/* Refresh + Delete */}
                <div className="flex flex-col gap-1 pt-5">
                  <button
                    type="button"
                    onClick={() => fetchPriceForRow(idx)}
                    disabled={h.loading || !h.ticker}
                    className="p-1.5 rounded-md border border-border hover:border-primary transition-colors disabled:opacity-40"
                    style={{ minHeight: 'unset' }}
                    title="Refresh price"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${h.loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-1.5 rounded-md border border-border hover:border-destructive transition-colors"
                    style={{ minHeight: 'unset' }}
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Price + Value row */}
              <div className="flex items-center justify-between text-xs px-0.5">
                {h.loading ? (
                  <span className="text-muted-foreground">Fetching price…</span>
                ) : h.error ? (
                  <span className="text-destructive">{h.error}</span>
                ) : h.last_price ? (
                  <span className="text-muted-foreground">
                    ${h.last_price.toFixed(2)}/share{impliedShares != null ? ` · ${impliedShares.toFixed(4)} sh` : ''}
                  </span>
                ) : (
                  <span className="text-muted-foreground/40">Enter ticker to fetch price</span>
                )}
                {value > 0 && (
                  <span className="font-bold text-foreground">{formatCurrency(value)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add holding button */}
      <button
        type="button"
        onClick={addRow}
        className="w-full py-2 rounded-lg border border-dashed border-primary/40 text-xs font-semibold text-primary flex items-center justify-center gap-1.5 hover:border-primary hover:bg-primary/5 transition-colors"
        style={{ minHeight: 'unset' }}
      >
        <Plus className="w-3.5 h-3.5" /> Add Holding
      </button>

      {/* MFW Total */}
      {mfwTotal > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">MFW Total</span>
          <span className="text-lg font-black text-primary">{formatCurrency(mfwTotal)}</span>
        </div>
      )}

      {/* Refresh all + Save */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => refreshAllPrices(holdings)}
          disabled={refreshingAll}
          className="flex-shrink-0 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          style={{ minHeight: 'unset' }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshingAll ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
        <Button onClick={handleSave} disabled={saving} className="flex-1 h-10 font-bold gap-2">
          {saved
            ? <><CheckCircle2 className="w-4 h-4" /> Saved!</>
            : saving ? 'Saving…' : 'Save MFW Holdings'
          }
        </Button>
      </div>
    </div>
  );
}

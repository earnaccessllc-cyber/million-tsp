import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { formatCurrency } from '@/lib/tspFunds';
import { TrendingUp, TrendingDown, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import YTDBadge from '@/components/dashboard/YTDBadge';
import { useProfile } from '@/context/ProfileContext';
import { rebalanceFundAllocations } from '@/lib/rebalanceFunds';
import { calcYTD } from '@/lib/contributionCalc';
import { formatUpdatedAt, localDateString } from '@/lib/balanceUpdatedAt';

// Shows when the balance was actually priced, in the viewer's own timezone.
// This used to append a hardcoded "at 8:00pm ET" to whatever date was stored,
// which stopped being true on both halves: the price update is polled now, so
// the time moves with when the source publishes, and the viewer isn't
// necessarily in Eastern.
function LastUpdateLabel({ profile }) {
  const label = formatUpdatedAt(profile?.balance_last_confirmed_at, profile?.balance_last_confirmed);
  if (!label) return null;
  return <p className="text-xs text-muted-foreground mt-1">Updated {label}</p>;
}

export default function BalanceHero({ totalBalance, dailyChange, dailyChangePercent, highestBalance, highestBalanceDate, openingBalance, funds, profile }) {
  const { activeProfile, refreshProfiles } = useProfile();
  const isPositive = (dailyChange || 0) >= 0;
  // The date this balance is actually priced for, not whatever today happens to
  // be in the browser — those differ every evening before the update lands, and
  // on every weekend and holiday.
  const asOf = formatUpdatedAt(profile?.balance_last_confirmed_at, profile?.balance_last_confirmed, { long: true })
    || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const employmentType = profile?.employment_type === 'military' ? 'Military' : 'Civilian';

  const [inputVal, setInputVal] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const debounceTimer = useRef(null);
  const inputValRef = useRef(inputVal);

  useEffect(() => { inputValRef.current = inputVal; }, [inputVal]);

  const formatWithCommas = (val) => {
    const num = parseFloat(String(val).replace(/,/g, ''));
    if (!num && num !== 0) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    const current = activeProfile?.total_balance_manual || totalBalance || 0;
    setInputVal(current > 0 ? formatWithCommas(current) : '');
    setIsDirty(false);
  }, [activeProfile?.total_balance_manual, totalBalance]);

  // mfw_balance and has_mfw must be in the dep list, not just the id. This
  // callback is captured for the lifetime of a mounted tab, and the MFW price
  // job rewrites mfw_balance every morning — so a stale capture would subtract
  // yesterday's MFW figure here, seeding the funds with the wrong non-MFW total
  // and putting the account right back out of step with tsp.gov the moment the
  // user had just corrected it.
  const handleUpdate = useCallback(async (val) => {
    const raw = parseFloat(String(val ?? inputValRef.current).replace(/,/g, '')) || 0;
    if (!activeProfile?.id || !raw) return;

    setSaving(true);
    setIsDirty(false);

    try {
      await base44.entities.TSPProfile.update(activeProfile.id, {
        total_balance_manual: raw,
        // Local date, not UTC: toISOString() rolls over during the evening for
        // US users and would stamp the balance with tomorrow's market day.
        balance_last_confirmed: localDateString(),
        balance_last_confirmed_at: new Date().toISOString(),
      });
      // total_balance_manual is the grand total, MFW included — so only the
      // non-MFW remainder is what the TSP funds have to add up to. Mirrors the
      // has_mfw guard in CurrentBalanceSettings: a leftover mfw_balance on a
      // profile that has since turned MFW off must not be subtracted.
      const mfwBalance = activeProfile?.has_mfw ? (activeProfile?.mfw_balance || 0) : 0;
      await rebalanceFundAllocations(activeProfile.id, raw - mfwBalance);
      await refreshProfiles();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      // no rollback needed — UI still reflects activeProfile, which was never optimistically changed
    } finally {
      setSaving(false);
    }
  }, [activeProfile?.id, activeProfile?.has_mfw, activeProfile?.mfw_balance]);

  // Auto-save 2.5s after user stops typing
  const scheduleAutoSave = (val) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      handleUpdate(val);
    }, 2500);
  };

  // Save on page hide (tab close, navigate away)
  useEffect(() => {
    const handlePageHide = () => {
      if (isDirty) handleUpdate(inputValRef.current);
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      clearTimeout(debounceTimer.current);
    };
  }, [isDirty, handleUpdate]);

  // Weighted YTD from fund prices
  const weightedYTD = (() => {
    const activeFunds = (funds || []).filter(f => f.is_selected && f.balance > 0 && f.return_percent != null);
    const totalFundBal = activeFunds.reduce((s, f) => s + f.balance, 0);
    if (!activeFunds.length || !totalFundBal) return null;
    return activeFunds.reduce((s, f) => s + f.return_percent * (f.balance / totalFundBal), 0);
  })();

  const opening = profile?.opening_balance || openingBalance || 0;
  const displayBalance = parseFloat(String(inputVal).replace(/,/g, '')) || totalBalance || 0;

  // TSP.gov's own YTD % is investment performance only — it excludes new money
  // added to the account this year (contributions, agency match, loan
  // repayments), so it doesn't inflate just because you're still funding the
  // account. Matching that here: strip this year's contributions out of the
  // raw balance growth before computing the percentage, same residual
  // ("gainLoss") approach YTD Activity already uses.
  const ytd = calcYTD(profile);
  const contributionsYTD = ytd.tradYTD + ytd.rothYTD + ytd.matchYTD + ytd.auto1YTD + ytd.loanYTD;
  const investmentGainYTD = displayBalance - opening - contributionsYTD;
  const accountYTD = opening > 0 ? (investmentGainYTD / opening) * 100 : null;

  const openingExclLoan = profile?.opening_balance_excl_loan;
  // Derived from the real loans array, not the legacy standalone loan_repayments
  // field — that one isn't kept in sync and can drift from actual loan edits.
  const hasLoan = !!((Array.isArray(profile?.loans) && profile.loans.length > 0) && openingExclLoan);
  const investmentGainExclLoan = displayBalance - openingExclLoan - contributionsYTD;
  const accountYTDExclLoan = hasLoan && openingExclLoan > 0
    ? (investmentGainExclLoan / openingExclLoan) * 100
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-4 pb-4"
    >
      {/* Account label */}
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
        Thrift Savings Plan — {employmentType}
      </p>
      <p className="text-xs text-muted-foreground mb-3">as of {asOf}</p>

      {/* MFW breakdown — shown above input when MFW is active */}
      {profile?.has_mfw && profile?.mfw_balance > 0 && (
        <div className="mb-3 rounded-lg bg-secondary/40 border border-border px-3 py-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">TSP Balance</span>
            <span className="font-semibold text-foreground">{formatCurrency(totalBalance - (profile.mfw_balance || 0))}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">+ MFW</span>
            <span className="font-semibold text-primary">{formatCurrency(profile.mfw_balance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-border pt-1 mt-1">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-black text-foreground">{formatCurrency(totalBalance)}</span>
          </div>
        </div>
      )}

      {/* Editable Current Balance */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Current Balance</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground text-xl font-black pointer-events-none">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={inputVal}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                setInputVal(raw);
                setSaved(false);
                setIsDirty(true);
                scheduleAutoSave(raw);
              }}
              onFocus={() => {
                setIsFocused(true);
                setInputVal(String(inputVal).replace(/,/g, ''));
              }}
              onBlur={() => {
                setIsFocused(false);
                if (inputVal) setInputVal(formatWithCommas(inputVal));
                if (isDirty) {
                  clearTimeout(debounceTimer.current);
                  handleUpdate(inputVal);
                }
              }}
              onKeyDown={e => { if (e.key === 'Enter') { clearTimeout(debounceTimer.current); handleUpdate(inputVal); } }}
              className="w-full pl-7 pr-3 h-12 text-2xl font-black bg-secondary/40 border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-foreground"
              placeholder="0.00"
            />
          </div>
          <button
            onClick={() => { clearTimeout(debounceTimer.current); handleUpdate(inputVal); }}
            disabled={saving}
            className={`h-12 px-4 rounded-xl text-sm font-bold transition-all flex-shrink-0 ${
              saved
                ? 'bg-gain/20 text-gain border border-gain/30'
                : isDirty
                  ? 'bg-primary/60 text-primary-foreground border border-primary/40'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : saving ? '…' : isDirty ? 'Save' : 'Update'}
          </button>
        </div>
      </div>

      {/* YTD badges */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {accountYTD !== null && (
          <div className="flex flex-col gap-0.5">
            <YTDBadge
              percent={accountYTD}
              baselineDate={`Jan 1, ${new Date().getFullYear()}`}
              baselineSource="TSP.gov historical data"
            />
            <span className="text-xs text-muted-foreground pl-1">vs. Jan 1 opening balance</span>
          </div>
        )}
        {accountYTDExclLoan !== null && (
          <div className="flex flex-col gap-0.5">
            <YTDBadge
              percent={accountYTDExclLoan}
              label="excl. loan"
              size="sm"
              baselineDate={`Jan 1, ${new Date().getFullYear()}`}
              baselineSource="excl. loan balance"
            />
          </div>
        )}
        {accountYTD === null && weightedYTD !== null && (
          <YTDBadge
            percent={weightedYTD}
            baselineDate={`Jan 1, ${new Date().getFullYear()}`}
            baselineSource="TSP.gov share price history"
          />
        )}
      </div>

      {/* Daily change */}
      <div className="flex items-center gap-2 flex-wrap">
        {isPositive
          ? <TrendingUp className="w-4 h-4 text-gain" />
          : <TrendingDown className="w-4 h-4 text-loss" />
        }
        <span className={`text-sm font-semibold ${isPositive ? 'text-gain' : 'text-loss'}`}>
          {isPositive ? '▲' : '▼'} {formatCurrency(Math.abs(dailyChange || 0))} ({Math.abs(dailyChangePercent || 0).toFixed(2)}%) today
        </span>
      </div>

      {/* Last update timestamp */}
      <LastUpdateLabel profile={profile} />
    </motion.div>
  );
}

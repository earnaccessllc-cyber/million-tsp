import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, RefreshCw, CheckCircle2, ExternalLink, History } from 'lucide-react';
import { calcOpeningBalance } from '@/functions/calcOpeningBalance';

const currentYear = new Date().getFullYear();

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OpeningBalanceSettings() {
  const { activeProfile, refreshProfiles } = useProfile();
  const [openingBal, setOpeningBal] = useState(activeProfile?.opening_balance ?? '');
  const [openingBalExclLoan, setOpeningBalExclLoan] = useState(activeProfile?.opening_balance_excl_loan ?? '');
  const [employmentType, setEmploymentType] = useState(activeProfile?.employment_type ?? 'civilian');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoCalcing, setAutoCalcing] = useState(false);
  const [autoCalcMsg, setAutoCalcMsg] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Derived from the real loans array, not the legacy standalone loan_repayments
  // field — that one isn't kept in sync and had drifted to 0, hiding this
  // section even though real active loans existed.
  const hasLoan = Array.isArray(activeProfile?.loans) && activeProfile.loans.length > 0;

  useEffect(() => {
    setOpeningBal(activeProfile?.opening_balance ?? '');
    setOpeningBalExclLoan(activeProfile?.opening_balance_excl_loan ?? '');
    setEmploymentType(activeProfile?.employment_type ?? 'civilian');
  }, [activeProfile?.id]);

  useEffect(() => {
    if (!activeProfile?.id) return;
    setLoadingHistory(true);
    base44.entities.OpeningBalanceHistory.filter({ profile_id: activeProfile.id })
      .then(rows => {
        setHistory(rows.sort((a, b) => b.year - a.year));
        setLoadingHistory(false);
      });
  }, [activeProfile?.id, saved]);

  const handleAutoCalc = async () => {
    if (!activeProfile?.id) return;
    setAutoCalcing(true);
    setAutoCalcMsg(null);
    const res = await calcOpeningBalance({ profile_id: activeProfile.id });
    if (res.data?.success && res.data?.opening_balance > 0) {
      const bal = res.data.opening_balance;
      setOpeningBal(bal.toFixed(2));
      setAutoCalcMsg(`✅ Auto-calculated: $${bal.toLocaleString('en-US', { maximumFractionDigits: 2 })} (from TSP.gov — Jan 1, ${currentYear} share prices)`);
      refreshProfiles();
    } else {
      setAutoCalcMsg('⚠️ Could not auto-calculate. Enter your opening balance manually above.');
    }
    setAutoCalcing(false);
  };

  const handleSave = async () => {
    if (!activeProfile?.id) return;
    setSaving(true);
    const updates = { employment_type: employmentType };
    const bal = parseFloat(openingBal) || 0;
    if (openingBal !== '') updates.opening_balance = bal;
    if (hasLoan && openingBalExclLoan !== '') updates.opening_balance_excl_loan = parseFloat(openingBalExclLoan) || 0;
    await base44.entities.TSPProfile.update(activeProfile.id, updates);

    // Upsert into OpeningBalanceHistory
    if (bal > 0) {
      const today = new Date().toISOString().split('T')[0];
      const existing = history.find(h => h.year === currentYear);
      if (existing) {
        await base44.entities.OpeningBalanceHistory.update(existing.id, {
          opening_balance: bal,
          source: 'manual',
          source_date: today,
        });
      } else {
        await base44.entities.OpeningBalanceHistory.create({
          profile_id: activeProfile.id,
          year: currentYear,
          opening_balance: bal,
          source: 'manual',
          source_date: today,
        });
      }
    }

    await refreshProfiles();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!activeProfile) return null;

  // Source label for current year's history entry
  const currentYearHistory = history.find(h => h.year === currentYear);
  const sourceNote = currentYearHistory?.source === 'auto'
    ? `Auto-set from Dec 31 balance. Tap to update manually.`
    : currentYearHistory?.source_date
    ? `Last manually updated: ${currentYearHistory.source_date}`
    : null;

  return (
    <div className="p-4 bg-card rounded-xl border border-border space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Opening TSP Balance — January 1, {currentYear}
        </h3>
      </div>

      {/* Employment Type */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Account Type</Label>
        <div className="flex gap-2">
          {['civilian', 'military'].map(type => (
            <button
              key={type}
              onClick={() => setEmploymentType(type)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors capitalize ${
                employmentType === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary/50 border-border text-muted-foreground'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-calc button */}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
          onClick={handleAutoCalc}
          disabled={autoCalcing}
        >
          {autoCalcing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          {autoCalcing ? 'Fetching from TSP.gov…' : 'Auto-Calculate from TSP.gov'}
        </Button>
        {autoCalcMsg && (
          <p className={`text-[10px] mt-1.5 leading-relaxed ${autoCalcMsg.startsWith('✅') ? 'text-gain' : 'text-muted-foreground'}`}>
            {autoCalcMsg}
          </p>
        )}
      </div>

      {/* Opening Balance input */}
      <div>
        <Label className="text-sm font-semibold text-foreground mb-1.5 block">
          Opening TSP Balance — January 1, {currentYear}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
          <Input
            type="number"
            value={openingBal}
            onChange={e => { setOpeningBal(e.target.value); setSaved(false); }}
            className="pl-6 h-11 text-base font-semibold"
            placeholder="0.00"
          />
        </div>

        {sourceNote && (
          <p className="text-[10px] text-muted-foreground mt-1 italic">{sourceNote}</p>
        )}

        <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
          Enter your TSP balance as of January 1, {currentYear}. This is used to calculate your Year-To-Date (YTD) performance.
        </p>

        {/* Helper tip */}
        <div className="mt-2 p-2.5 bg-secondary/30 rounded-lg border border-border/50">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            💡 Find this on TSP.gov → My Account → Statements → December {currentYear - 1} statement. The closing balance = your January 1 opening balance.
          </p>
          <a
            href="https://www.tsp.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
          >
            Open TSP.gov <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* Loan exclusion */}
      {hasLoan && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Opening Balance Excluding Loan (January 1, {currentYear})
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              type="number"
              value={openingBalExclLoan}
              onChange={e => setOpeningBalExclLoan(e.target.value)}
              className="pl-6 h-10 text-sm"
              placeholder="e.g. 240000"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Used to show YTD % excluding the loan balance.
          </p>
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saved
          ? <><CheckCircle2 className="w-4 h-4" /> ✅ Opening balance saved for {currentYear} YTD tracking</>
          : saving ? 'Saving…' : 'Save Opening Balance'
        }
      </Button>

      {/* Opening Balance History */}
      {(loadingHistory || history.length > 0) && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opening Balance History</p>
          </div>
          {loadingHistory ? (
            <p className="text-[10px] text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-3 text-[9px] text-muted-foreground uppercase tracking-wider pb-1 border-b border-border">
                <span>Year</span>
                <span className="text-right">Opening Balance</span>
                <span className="text-right">Source</span>
              </div>
              {history.map(row => {
                const isCurrentYear = row.year === currentYear;
                const growth = row.closing_balance && row.opening_balance
                  ? ((row.closing_balance - row.opening_balance) / row.opening_balance * 100).toFixed(1)
                  : null;
                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-3 text-[11px] py-1.5 border-b border-border/40 last:border-0 ${isCurrentYear ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
                  >
                    <span className="flex items-center gap-1">
                      {row.year}
                      {isCurrentYear && <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded">current</span>}
                    </span>
                    <span className="text-right">{fmt(row.opening_balance)}</span>
                    <span className="text-right text-[10px]">
                      {row.source === 'auto' ? 'Auto' : 'Manual'}
                      {growth !== null && (
                        <span className={`ml-1 ${parseFloat(growth) >= 0 ? 'text-gain' : 'text-loss'}`}>
                          ({growth >= 0 ? '+' : ''}{growth}%)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
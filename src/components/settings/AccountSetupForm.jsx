import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { ALL_FUNDS } from '@/lib/tspFunds';
import { fetchLivePricesSheet } from '@/functions/fetchLivePricesSheet';

const CORE_FUNDS = ALL_FUNDS.filter(f => !f.key.startsWith('L') && f.name !== 'MFW');
const LIFECYCLE_FUNDS = ALL_FUNDS.filter(f => f.key.startsWith('L'));

function parseDollar(val) {
  if (!val && val !== 0) return 0;
  return parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0;
}

function DollarInput({ value, onChange, placeholder = '$0.00', id }) {
  const [focused, setFocused] = useState(false);

  const handleChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    onChange(raw);
  };

  const display = focused
    ? value
    : value
    ? `$${parseFloat(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '';

  return (
    <input
      id={id}
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-primary transition-colors"
    />
  );
}

function FundRow({ fund, checked, pct, onCheck, onPct }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={() => onCheck(!checked)}
        className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          checked ? 'bg-primary border-primary' : 'border-border bg-transparent'
        }`}
      >
        {checked && <span className="text-primary-foreground text-xs font-bold">✓</span>}
      </button>
      <span className="flex-1 text-sm text-foreground">{fund.name}</span>
      {checked && (
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.01"
            value={pct}
            onChange={e => onPct(e.target.value)}
            placeholder=""
            className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      )}
    </div>
  );
}

export default function AccountSetupForm() {
  const { refreshProfiles } = useProfile();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [openingBalance, setOpeningBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [allocations, setAllocations] = useState({});
  const [hasMFW, setHasMFW] = useState(false);
  const [mfwPct, setMfwPct] = useState('');
  const [mfwDollar, setMfwDollar] = useState('');
  const [dob, setDob] = useState('');
  const [serviceStart, setServiceStart] = useState('');
  const [retirementSystem, setRetirementSystem] = useState('FERS');
  const [balanceGoal, setBalanceGoal] = useState('1000000');

  const setAlloc = (fundName, key, val) => {
    setAllocations(prev => ({ ...prev, [fundName]: { ...prev[fundName], [key]: val } }));
  };

  const totalPct = Object.values(allocations).reduce((s, v) => s + (parseFloat(v.pct) || 0), 0)
    + (hasMFW ? (parseFloat(mfwPct) || 0) : 0);
  const totalOk = Math.abs(totalPct - 100) < 0.01;

  const anyFundSelected = Object.values(allocations).some(v => v.selected) || hasMFW;
  const canSave = parseDollar(openingBalance) > 0
    && parseDollar(currentBalance) > 0
    && anyFundSelected
    && totalOk
    && dob
    && serviceStart
    && retirementSystem;

  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setSaveError('');

    try {
      const today = new Date().toISOString().split('T')[0];
      const totalManual = parseDollar(currentBalance);
      const mfwBal = hasMFW ? (parseDollar(mfwDollar) || 0) : 0;
      const openBal = parseDollar(openingBalance);
      const goal = parseDollar(balanceGoal) || 1000000;

      // Check for an existing profile — update instead of creating a duplicate
      const currentUser = await base44.auth.me().catch(() => null);
      const existingProfiles = await base44.entities.TSPProfile.list();
      const existingProfile = existingProfiles[0] || null;

      const profileData = {
        name: currentUser?.full_name || 'My TSP',
        plan: 'free',
        employment_type: 'civilian',
        entry_method: 'percent',
        total_balance_manual: totalManual,
        opening_balance: openBal,
        balance_last_confirmed: today,
        balance_install_date: today,
        has_mfw: hasMFW,
        mfw_balance: mfwBal,
        date_of_birth: dob || null,
        career_start_date: serviceStart || null,
        retirement_system: retirementSystem,
        balance_goal: goal,
      };

      // Step 1: Update existing profile or create — never create duplicates
      let profile;
      if (existingProfile) {
        await base44.entities.TSPProfile.update(existingProfile.id, profileData);
        profile = { ...existingProfile, ...profileData };
      } else {
        profile = await base44.entities.TSPProfile.create(profileData);
      }

      if (!profile || !profile.id) {
        throw new Error('Profile could not be saved. Please try again.');
      }

      // Step 3: Fetch live prices (optional, non-blocking on timeout)
      let livePrices = {};
      try {
        const res = await Promise.race([
          fetchLivePricesSheet({}),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ]);
        for (const f of (res.data?.funds || [])) livePrices[f.fund_name] = f;
      } catch (_) {}

      const nonMfwTotal = Math.max(0, totalManual - mfwBal);

      // Step 4: Create fund allocations and wait for all of them
      await Promise.all(ALL_FUNDS.map(f => {
        const entry = allocations[f.name] || {};
        const isSelected = !!entry.selected;
        const allocPct = parseFloat(entry.pct) || 0;
        const closingPrice = livePrices[f.name]?.share_price ?? 0;
        const computedBalance = isSelected && nonMfwTotal > 0 ? nonMfwTotal * (allocPct / 100) : 0;
        const computedShares = computedBalance > 0 && closingPrice > 0 ? computedBalance / closingPrice : 0;
        return base44.entities.FundAllocation.create({
          profile_id: profile.id,
          fund_name: f.name,
          fund_type: f.key.startsWith('L') ? 'lifecycle' : 'core',
          is_selected: isSelected,
          allocation_percent: allocPct,
          balance: computedBalance,
          dollar_balance: computedBalance,
          shares: computedShares,
          share_price: closingPrice,
          last_price_update: closingPrice > 0 ? today : null,
        });
      }));

      // Step 5: Mark setup complete
      localStorage.setItem('setupComplete', 'true');

      // Step 6: Refresh profiles and only THEN navigate
      await refreshProfiles();
      navigate('/', { replace: true });
    } catch (e) {
      console.error('Setup save error:', e);
      setSaveError(e?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(201,168,50,0.08)', border: '1px solid rgba(201,168,50,0.25)' }}>
        <span className="text-3xl">🛡️</span>
        <div>
          <h2 className="text-lg font-bold tracking-wider" style={{ color: '#C9A832' }}>ACCOUNT SETUP</h2>
          <p className="text-xs text-muted-foreground">Complete your profile to start tracking</p>
        </div>
      </div>

      {/* Who you're signed in as — with a way back to the login screen.
          This is the only exit from the setup screen, which renders before
          the Settings page's own Sign Out button and hides the nav chrome. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-card border border-border">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium text-foreground truncate">{user?.email || 'your account'}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1.5 flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Section 1 — Balance */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Balance</h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Opening TSP Balance — January 1, 2026 <span className="text-destructive">*</span></label>
          <p className="text-xs text-muted-foreground mb-2">Find on TSP.gov → My Account → Statements → December 2025 closing balance</p>
          <DollarInput value={openingBalance} onChange={setOpeningBalance} placeholder="" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Current TSP Balance <span className="text-destructive">*</span></label>
          <p className="text-xs text-muted-foreground mb-2">Enter your balance as of today</p>
          <DollarInput value={currentBalance} onChange={setCurrentBalance} placeholder="" />
        </div>
      </section>

      {/* Section 2 — Fund Allocation */}
      <section className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Fund Allocation</h3>
          <p className="text-xs text-muted-foreground mt-1">Select your funds and enter allocation %. Percentages must total exactly 100%.</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Core Funds</p>
          {CORE_FUNDS.map(f => (
            <FundRow
              key={f.name}
              fund={f}
              checked={!!allocations[f.name]?.selected}
              pct={allocations[f.name]?.pct || ''}
              onCheck={v => setAlloc(f.name, 'selected', v)}
              onPct={v => setAlloc(f.name, 'pct', v)}
            />
          ))}
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Lifecycle Funds</p>
          {LIFECYCLE_FUNDS.map(f => (
            <FundRow
              key={f.name}
              fund={f}
              checked={!!allocations[f.name]?.selected}
              pct={allocations[f.name]?.pct || ''}
              onCheck={v => setAlloc(f.name, 'selected', v)}
              onPct={v => setAlloc(f.name, 'pct', v)}
            />
          ))}
        </div>

        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Mutual Fund Window</p>
          <div className="flex items-center gap-3 py-2">
            <button
              type="button"
              onClick={() => setHasMFW(v => !v)}
              className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${hasMFW ? 'bg-primary border-primary' : 'border-border bg-transparent'}`}
            >
              {hasMFW && <span className="text-primary-foreground text-xs font-bold">✓</span>}
            </button>
            <span className="text-sm text-foreground">MFW (Mutual Fund Window)</span>
          </div>
          {hasMFW && (
            <div className="mt-2 space-y-2 pl-8">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  value={mfwPct}
                  onChange={e => setMfwPct(e.target.value)}
                  placeholder=""
                  className="w-16 bg-background border border-border rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted-foreground">% of total</span>
              </div>
              <DollarInput value={mfwDollar} onChange={setMfwDollar} placeholder="" />
            </div>
          )}
        </div>

        {/* Running total */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${totalOk ? 'border-gain/40 bg-gain/10' : 'border-destructive/40 bg-destructive/10'}`}>
          <span className="text-sm font-medium">Total Allocation</span>
          <span className={`text-sm font-bold ${totalOk ? 'text-gain' : 'text-destructive'}`}>
            {totalPct.toFixed(1)}% / 100% {totalOk && '✅'}
          </span>
        </div>
      </section>

      {/* Section 3 — Retirement Info */}
      <section className="space-y-4">
        <h3 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Retirement Info</h3>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Date of Birth <span className="text-destructive">*</span></label>
          <input
            type="date"
            value={dob}
            onChange={e => setDob(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Federal Service Start Date <span className="text-destructive">*</span></label>
          <input
            type="date"
            value={serviceStart}
            onChange={e => setServiceStart(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-primary"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Retirement System <span className="text-destructive">*</span></label>
          <p className="text-xs text-muted-foreground mb-1">Most employees hired after 1987 are FERS</p>
          <select
            value={retirementSystem}
            onChange={e => setRetirementSystem(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-primary"
          >
            <option value="FERS">FERS</option>
            <option value="CSRS">CSRS</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">TSP Goal</label>
          <p className="text-xs text-muted-foreground mb-1">Optional — default $1,000,000</p>
          <DollarInput value={balanceGoal} onChange={setBalanceGoal} placeholder="$1,000,000" />
        </div>
      </section>

      {/* Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave || saving}
        className="w-full py-4 rounded-xl text-base font-bold tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: canSave && !saving ? '#FFD700' : '#8B6914', color: '#0a0a0a', minHeight: 56 }}
      >
          {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            SAVING...
          </span>
        ) : 'SAVE & GO TO DASHBOARD →'}
      </button>

      {saveError && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive text-center">
          {saveError}
        </div>
      )}
    </div>
  );
}
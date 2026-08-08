import React, { useState } from 'react';
import { ObProgressBar, ObStepDots, ObMiniLogo, ObBack, ObButton, ObSectionLabel } from './ObLayout';
import { BG, INPUT_BG, GOLD, GOLD_BRIGHT, GOLD_GRADIENT, GOLD_DARK, formatCurrency, parseDollar } from './ob-constants';

function ObDateField({ label, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <ObSectionLabel>{label}</ObSectionLabel>
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full outline-none"
        style={{
          height: 50, borderRadius: 10,
          background: INPUT_BG,
          border: `1.5px solid ${focused || value ? GOLD : 'rgba(255,255,255,0.1)'}`,
          boxShadow: focused ? '0 0 0 3px rgba(201,168,50,0.12)' : 'none',
          color: value ? GOLD_BRIGHT : 'rgba(255,255,255,0.3)',
          fontFamily: "'Orbitron',monospace", fontSize: 13, fontWeight: 700,
          padding: '0 16px',
          colorScheme: 'dark',
        }}
      />
    </div>
  );
}

function ObSelectField({ label, value, onChange, options, helper }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <ObSectionLabel>{label}</ObSectionLabel>
      <div className="relative">
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full outline-none appearance-none"
          style={{
            height: 50, borderRadius: 10,
            background: INPUT_BG,
            border: `1.5px solid ${focused || value ? GOLD : 'rgba(255,255,255,0.1)'}`,
            boxShadow: focused ? '0 0 0 3px rgba(201,168,50,0.12)' : 'none',
            color: value ? GOLD_BRIGHT : 'rgba(255,255,255,0.3)',
            fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700,
            padding: '0 40px 0 16px',
          }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {/* Gold arrow */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="12" height="8" viewBox="0 0 12 8">
            <polyline points="1,1 6,7 11,1" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      {helper && (
        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9.5, color: '#AAAAAA', marginTop: 4, letterSpacing: '0.02em' }}>
          {helper}
        </p>
      )}
    </div>
  );
}

function ObDollarField({ label, value, onChange, placeholder, helper, onKeyDown }) {
  const [focused, setFocused] = useState(false);
  const hasVal = parseDollar(value) > 0;
  return (
    <div>
      <ObSectionLabel>{label}</ObSectionLabel>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 700, color: focused || hasVal ? GOLD : 'rgba(255,255,255,0.25)' }}>$</span>
        <input
          type="text" inputMode="decimal"
          value={value || ''}
          onChange={e => onChange(formatCurrency(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder || '0.00'}
          className="w-full outline-none"
          style={{
            height: 50, borderRadius: 10,
            background: INPUT_BG,
            border: `1.5px solid ${focused || hasVal ? GOLD : 'rgba(255,255,255,0.1)'}`,
            boxShadow: focused ? '0 0 0 3px rgba(201,168,50,0.12)' : 'none',
            color: hasVal ? GOLD_BRIGHT : 'rgba(255,255,255,0.3)',
            fontFamily: "'Orbitron',monospace", fontSize: 15, fontWeight: 700,
            paddingLeft: 40, paddingRight: 16,
          }}
        />
      </div>
      {helper && (
        <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9.5, color: '#AAAAAA', marginTop: 4, letterSpacing: '0.02em' }}>
          {helper}
        </p>
      )}
    </div>
  );
}

export default function ObStep3({ form, update, onFinish, onBack, saving, saveError }) {
  return (
    <div className="flex flex-col" style={{ background: BG, minHeight: '100dvh' }}>
      <ObProgressBar pct={100} />

      <div className="flex items-center gap-2 px-3 pt-1">
        <ObBack onBack={onBack} />
      </div>
      <ObStepDots current={4} />

      {/* Scrollable content — leaves room for the fixed button */}
      <div className="flex-1 flex flex-col px-5 overflow-y-auto" style={{ paddingBottom: 100 }}>
        <h2 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          Tell us about yourself
        </h2>
        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500, color: '#CCCCCC', marginBottom: 6 }}>
          All fields optional — you can fill these in Settings later
        </p>

        <ObDateField
          label="Date of Birth"
          value={form.date_of_birth}
          onChange={v => update('date_of_birth', v)}
        />

        <ObDateField
          label="Federal Service Start Date"
          value={form.career_start_date}
          onChange={v => update('career_start_date', v)}
        />

        <ObSelectField
          label="Retirement System"
          value={form.retirement_system}
          onChange={v => update('retirement_system', v)}
          options={[
            { value: 'FERS', label: 'FERS' },
            { value: 'CSRS', label: 'CSRS' },
          ]}
          helper="Most employees hired after 1987 are FERS"
        />

        <ObDollarField
          label="My TSP Goal"
          value={form.balance_goal}
          onChange={v => update('balance_goal', v)}
          placeholder="1,000,000"
          helper="How much do you want to have saved by retirement? (default: $1,000,000)"
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        />
      </div>

      {/* Fixed bottom button — always visible above keyboard */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 20px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          background: `linear-gradient(to top, ${BG} 60%, transparent)`,
          zIndex: 9999,
        }}
      >
        {saveError && (
          <div style={{
            marginBottom: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(255,68,68,0.15)',
            border: '1px solid rgba(255,68,68,0.5)',
            color: '#ff6b6b',
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            ⚠️ {saveError}
          </div>
        )}
        <button
          type="button"
          onClick={onFinish}
          disabled={saving}
          style={{
            width: '100%',
            minHeight: 56,
            background: saving ? '#8B6914' : '#FFD700',
            color: '#000000',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Exo 2',sans-serif",
            letterSpacing: '0.05em',
            padding: '16px 0',
            borderRadius: 14,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: saving ? 'none' : '0 4px 24px rgba(255,215,0,0.35)',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          {saving ? (
            <>
              <span style={{
                width: 18, height: 18,
                border: '2.5px solid rgba(0,0,0,0.4)',
                borderTopColor: '#000',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.7s linear infinite',
              }} />
              SETTING UP…
            </>
          ) : "LET'S GO 🚀"}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
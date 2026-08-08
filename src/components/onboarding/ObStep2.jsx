import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ObProgressBar, ObStepDots, ObMiniLogo, ObBack, ObButton, ObSectionLabel } from './ObLayout';
import { BG, INPUT_BG, GOLD, GOLD_BRIGHT, SUCCESS, ERROR, LIFECYCLE_COLOR, CORE_FUND_COLORS, FUND_NAME_GROUPS, parseDollar, formatCurrency } from './ob-constants';

function Checkbox({ checked, onChange }) {
  return (
    <button
      onClick={onChange}
      className="flex-shrink-0 flex items-center justify-center transition-all duration-150"
      style={{
        width: 20, height: 20, borderRadius: 5,
        border: `2px solid ${checked ? GOLD : 'rgba(255,255,255,0.2)'}`,
        background: checked ? GOLD : 'transparent',
      }}
    >
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9">
          <polyline points="1.5,4.5 4.5,7.5 9.5,1.5" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function FundRow({ name, color, selected, pct, onToggle, onPctChange }) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 transition-all duration-150"
      style={{
        background: selected ? 'rgba(201,168,50,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1.5px solid ${selected ? 'rgba(201,168,50,0.22)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <Checkbox checked={selected} onChange={onToggle} />
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 600, flex: 1,
        color: selected ? '#FFD700' : '#FFFFFF',
      }}>{name}</span>
      {selected ? (
        <div className="flex items-center gap-1">
          <input
            type="number" min="0" max="100" step="1"
            value={pct}
            onChange={e => onPctChange(e.target.value)}
            placeholder="0"
            className="outline-none text-right"
            style={{
              width: 52, height: 32, borderRadius: 8,
              background: INPUT_BG,
              border: `1.5px solid rgba(201,168,50,0.35)`,
              color: GOLD_BRIGHT,
              fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700,
              padding: '0 8px',
            }}
          />
          <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#AAAAAA' }}>%</span>
        </div>
      ) : (
        <span style={{
          width: 52, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'rgba(255,255,255,0.12)',
        }}>—</span>
      )}
    </div>
  );
}

export default function ObStep2({ form, update, onNext, onBack }) {
  const allocs = form.allocations || {};

  const toggle = (name) => {
    const curr = allocs[name] || {};
    update('allocations', { ...allocs, [name]: { ...curr, selected: !curr.selected, pct: curr.selected ? '' : curr.pct } });
  };
  const setPct = (name, val) => {
    update('allocations', { ...allocs, [name]: { ...(allocs[name] || {}), selected: true, pct: val } });
  };
  const toggleMfw = () => update('has_mfw', !form.has_mfw);

  const fundTotal = Object.entries(allocs).reduce((s, [, v]) => s + (v.selected ? (parseFloat(v.pct) || 0) : 0), 0);
  const mfwPct = form.has_mfw ? (parseFloat(form.mfw_pct) || 0) : 0;
  const total = fundTotal + mfwPct;
  const isOver = total > 100.05;
  const isExact = Math.abs(total - 100) < 0.1;

  const totalColor = isExact ? SUCCESS : isOver ? ERROR : 'rgba(255,255,255,0.45)';
  const totalBg = isExact ? 'rgba(0,200,81,0.08)' : isOver ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.04)';
  const totalBorder = isExact ? 'rgba(0,200,81,0.25)' : isOver ? 'rgba(255,68,68,0.25)' : 'rgba(255,255,255,0.08)';

  return (
    <div className="flex flex-col min-h-screen" style={{ background: BG }}>
      <ObProgressBar pct={66} />

      <div className="flex items-center gap-2 px-3 pt-1">
        <ObBack onBack={onBack} />
        <div className="flex-1" />
      </div>
      <ObStepDots current={3} />

      <div className="flex flex-col flex-1 overflow-hidden px-5">
        <h2 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          How is your TSP invested?
        </h2>
        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500, color: '#CCCCCC', marginBottom: 8 }}>
          Select funds & enter allocation %
        </p>

        {/* Scrollable fund list */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0, paddingBottom: 'calc(90px + env(safe-area-inset-bottom, 0px))' }}>
          <ObSectionLabel>Core Funds</ObSectionLabel>
          {FUND_NAME_GROUPS.core.map(name => (
            <FundRow key={name} name={name} color={CORE_FUND_COLORS[name]}
              selected={!!allocs[name]?.selected} pct={allocs[name]?.pct ?? ''}
              onToggle={() => toggle(name)} onPctChange={v => setPct(name, v)} />
          ))}

          <ObSectionLabel>Lifecycle Funds</ObSectionLabel>
          {FUND_NAME_GROUPS.lifecycle.map(name => (
            <FundRow key={name} name={name} color={LIFECYCLE_COLOR}
              selected={!!allocs[name]?.selected} pct={allocs[name]?.pct ?? ''}
              onToggle={() => toggle(name)} onPctChange={v => setPct(name, v)} />
          ))}

          <ObSectionLabel>Mutual Fund Window</ObSectionLabel>
          <div
            className="rounded-xl mb-1 overflow-hidden"
            style={{
              border: `1.5px solid ${form.has_mfw ? 'rgba(201,168,50,0.25)' : 'rgba(255,255,255,0.07)'}`,
              background: form.has_mfw ? 'rgba(201,168,50,0.06)' : 'rgba(255,255,255,0.02)',
            }}
          >
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <Checkbox checked={form.has_mfw} onChange={toggleMfw} />
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 600, flex: 1, color: form.has_mfw ? '#FFD700' : '#FFFFFF' }}>
                MFW (Mutual Fund Window)
              </span>
              {form.has_mfw ? (
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="100" step="1" value={form.mfw_pct || ''} onChange={e => update('mfw_pct', e.target.value)} placeholder="0"
                    className="outline-none text-right"
                    style={{ width: 52, height: 32, borderRadius: 8, background: INPUT_BG, border: '1.5px solid rgba(201,168,50,0.35)', color: GOLD_BRIGHT, fontFamily: "'Orbitron',monospace", fontSize: 12, fontWeight: 700, padding: '0 8px' }} />
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#AAAAAA' }}>%</span>
                </div>
              ) : (
                <span style={{ width: 52, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'rgba(255,255,255,0.12)' }}>—</span>
              )}
            </div>
            {form.has_mfw && (
              <div className="flex items-center gap-2 px-3 pb-3">
                <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: '#AAAAAA', width: 90 }}>DOLLAR AMT:</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2" style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, color: GOLD }}>$</span>
                  <input type="text" inputMode="decimal" value={form.mfw_balance || ''} onChange={e => update('mfw_balance', formatCurrency(e.target.value))} placeholder="0.00"
                    className="outline-none"
                    style={{ height: 32, width: 120, borderRadius: 8, background: INPUT_BG, border: '1.5px solid rgba(201,168,50,0.3)', color: GOLD_BRIGHT, fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, paddingLeft: 20, paddingRight: 8 }} />
                </div>
              </div>
            )}
          </div>

          {/* Total */}
          <div
            className="flex items-center justify-between px-3 py-2.5 rounded-xl mt-2"
            style={{ background: totalBg, border: `1.5px solid ${totalBorder}` }}
          >
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: totalColor }}>
              {isExact ? '✅ TOTAL ALLOCATED' : isOver ? '❌ OVER 100%' : 'TOTAL ALLOCATED'}
            </span>
            <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, fontWeight: 700, color: totalColor }}>
              {total.toFixed(1)}% / 100%
            </span>
          </div>

          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9.5, color: '#AAAAAA', marginTop: 8, textAlign: 'center', letterSpacing: '0.03em' }}>
            Your allocation % is shown as "Current Mix" on TSP.gov
          </p>
        </div>

      </div>

      {/* Fixed bottom button — always above safe area */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        background: `linear-gradient(to top, #08080a 60%, transparent)`,
        zIndex: 9999,
      }}>
        <ObButton onClick={onNext} disabled={!isExact}>
          CONTINUE &nbsp;<ChevronRight className="w-4 h-4" />
        </ObButton>
      </div>
    </div>
  );
}
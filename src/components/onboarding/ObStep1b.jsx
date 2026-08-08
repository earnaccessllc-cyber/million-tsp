import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ObProgressBar, ObStepDots, ObBack, ObButton, ObSectionLabel, ObMiniLogo } from './ObLayout';
import { BG, INPUT_BG, GOLD, GOLD_BRIGHT, SUCCESS } from './ob-constants';

const RETIREMENT_SYSTEM_MATCH = {
  FERS: 'FERS employees get up to 5% agency match — contribute at least 5% to get the full match.',
  CSRS: 'CSRS employees do not receive an agency match.',
};

export default function ObStep1b({ form, update, onNext, onBack }) {
  const [mode, setMode] = useState('percent'); // shared for both trad & roth

  const tradVal = mode === 'percent' ? (form.ob_trad_pct ?? '') : (form.ob_trad_dollar ?? '');
  const rothVal = mode === 'percent' ? (form.ob_roth_pct ?? '') : (form.ob_roth_dollar ?? '');

  const setTrad = (v) => {
    if (mode === 'percent') update('ob_trad_pct', v);
    else update('ob_trad_dollar', v);
  };
  const setRoth = (v) => {
    if (mode === 'percent') update('ob_roth_pct', v);
    else update('ob_roth_dollar', v);
  };

  const matchNote = RETIREMENT_SYSTEM_MATCH[form.retirement_system] || RETIREMENT_SYSTEM_MATCH.FERS;

  return (
    <div className="flex flex-col" style={{ background: BG, minHeight: '100dvh' }}>
      <ObProgressBar pct={44} />
      <div className="flex items-center gap-2 px-3 pt-1">
        <ObBack onBack={onBack} />
      </div>
      <ObStepDots current={2} total={4} />

      <div className="flex-1 flex flex-col px-5 pt-2 overflow-y-auto" style={{ paddingBottom: 110 }}>
        <h2 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
          Your Contributions
        </h2>
        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500, color: '#CCCCCC', marginBottom: 16 }}>
          Used to project when you'll hit your goal
        </p>

        {/* Pay Schedule */}
        <ObSectionLabel>Pay Schedule</ObSectionLabel>
        <div className="flex gap-2 mb-4">
          {[
            { value: 'biweekly', label: 'Biweekly', sub: 'Every 2 weeks' },
            { value: 'monthly', label: 'Monthly', sub: '12x per year' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('pay_schedule', opt.value)}
              className="flex-1 rounded-xl py-3 px-2 flex flex-col items-center gap-0.5 transition-all"
              style={{
                background: form.pay_schedule === opt.value ? 'rgba(201,168,50,0.12)' : INPUT_BG,
                border: `1.5px solid ${form.pay_schedule === opt.value ? GOLD : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 700, color: form.pay_schedule === opt.value ? GOLD_BRIGHT : '#CCCCCC' }}>
                {opt.label}
              </span>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: '#888' }}>{opt.sub}</span>
            </button>
          ))}
        </div>

        {/* % / $ mode toggle */}
        <ObSectionLabel>Contribution Type</ObSectionLabel>
        <div className="flex gap-2 mb-4">
          {[
            { value: 'percent', label: 'Percentage %' },
            { value: 'dollar', label: 'Dollar Amount $' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className="flex-1 rounded-xl py-2.5 px-2 text-center transition-all"
              style={{
                background: mode === opt.value ? 'rgba(201,168,50,0.12)' : INPUT_BG,
                border: `1.5px solid ${mode === opt.value ? GOLD : 'rgba(255,255,255,0.08)'}`,
                fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 700,
                color: mode === opt.value ? GOLD_BRIGHT : '#CCCCCC',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Traditional */}
        <ObSectionLabel>Traditional TSP Contribution</ObSectionLabel>
        <ContribInput
          value={tradVal}
          mode={mode}
          onChange={setTrad}
          placeholder={mode === 'percent' ? '5' : '200'}
        />

        {/* Roth */}
        <ObSectionLabel>Roth TSP Contribution <span style={{ color: '#888', fontFamily: "'Share Tech Mono',monospace", fontSize: 9 }}>(optional)</span></ObSectionLabel>
        <ContribInput
          value={rothVal}
          mode={mode}
          onChange={setRoth}
          placeholder="0"
        />

        {/* Agency match info */}
        <div className="mt-4 rounded-xl px-3 py-3" style={{ background: 'rgba(201,168,50,0.07)', border: '1px solid rgba(201,168,50,0.2)' }}>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: GOLD, letterSpacing: '0.08em', marginBottom: 4 }}>AGENCY MATCH INFO</p>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500, color: '#CCCCCC', lineHeight: 1.5 }}>
            {matchNote}
          </p>
        </div>
      </div>

      {/* Fixed bottom */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '12px 20px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        background: `linear-gradient(to top, ${BG} 60%, transparent)`,
        zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <ObButton onClick={onNext}>
          CONTINUE &nbsp;<ChevronRight className="w-4 h-4" />
        </ObButton>
        <button
          type="button"
          onClick={onNext}
          style={{
            background: 'transparent', border: 'none',
            color: '#888', fontFamily: "'Share Tech Mono',monospace",
            fontSize: 11, letterSpacing: '0.06em', cursor: 'pointer',
            padding: '4px 0', touchAction: 'manipulation',
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function ContribInput({ value, mode, onChange, placeholder }) {
  const [focused, setFocused] = useState(false);
  return (
    <div
      className="relative w-full mb-3"
      style={{
        borderRadius: 10,
        border: `1.5px solid ${focused ? GOLD : 'rgba(255,255,255,0.1)'}`,
        background: INPUT_BG,
        boxShadow: focused ? '0 0 0 3px rgba(201,168,50,0.12)' : 'none',
      }}
    >
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, fontWeight: 700, color: focused || value ? GOLD : 'rgba(255,255,255,0.25)' }}>
        {mode === 'percent' ? '' : '$'}
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="w-full outline-none bg-transparent"
        style={{
          height: 48,
          paddingLeft: mode === 'percent' ? 16 : 32,
          paddingRight: mode === 'percent' ? 36 : 16,
          fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 700,
          color: value ? GOLD_BRIGHT : 'rgba(255,255,255,0.3)',
        }}
      />
      {mode === 'percent' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ fontFamily: "'Orbitron',monospace", fontSize: 14, fontWeight: 700, color: value ? GOLD : 'rgba(255,255,255,0.25)' }}>
          %
        </span>
      )}
    </div>
  );
}
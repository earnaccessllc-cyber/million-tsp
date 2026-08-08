import React, { useState } from 'react';
import { ChevronRight, Paperclip } from 'lucide-react';
import { ObProgressBar, ObStepDots, ObMiniLogo, ObButton } from './ObLayout';
import { BG, INPUT_BG, GOLD, GOLD_BRIGHT, GOLD_GRADIENT, parseDollar, formatCurrency } from './ob-constants';

export default function ObStep1({ form, update, onNext }) {
  const [focused, setFocused] = useState(false);
  const canContinue = parseDollar(form.total_balance_manual) > 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: BG }}>
      <ObProgressBar pct={33} />
      <div className="flex items-center justify-between pr-4">
        <ObMiniLogo />
      </div>
      <ObStepDots current={1} />

      <div className="flex-1 flex flex-col px-5 pt-4">
        {/* Title */}
        <h1 style={{
          fontFamily: "'Exo 2',sans-serif", fontSize: 22, fontWeight: 800,
          color: '#fff', lineHeight: 1.2, marginBottom: 6,
        }}>
          What's your current<br />TSP balance?
        </h1>
        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 14, fontWeight: 500,
          color: '#CCCCCC', marginBottom: 28,
        }}>
          Find this on TSP.gov under My Account
        </p>

        {/* Dollar input */}
        <div
          className="relative w-full transition-all duration-200"
          style={{
            borderRadius: 10,
            border: `2px solid ${focused ? GOLD : 'rgba(255,255,255,0.1)'}`,
            boxShadow: focused ? `0 0 0 4px rgba(201,168,50,0.15), 0 0 20px rgba(201,168,50,0.12)` : 'none',
            background: INPUT_BG,
          }}
        >
          <span
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              fontFamily: "'Orbitron',monospace", fontSize: 22, fontWeight: 700,
              color: focused || canContinue ? GOLD : 'rgba(255,255,255,0.25)',
            }}
          >$</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.total_balance_manual}
            onChange={e => update('total_balance_manual', formatCurrency(e.target.value))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="0.00"
            className="w-full bg-transparent outline-none"
            style={{
              height: 68,
              paddingLeft: 48,
              paddingRight: 16,
              fontFamily: "'Orbitron',monospace",
              fontSize: 28,
              fontWeight: 700,
              color: canContinue ? GOLD_BRIGHT : 'rgba(255,255,255,0.6)',
            }}
          />
        </div>

        {/* TSP.gov link */}
        <a
          href="https://www.tsp.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 mt-4 transition-opacity hover:opacity-80"
          style={{ textDecoration: 'none' }}
        >
          <Paperclip className="w-3.5 h-3.5" style={{ color: GOLD }} />
          <span style={{
            fontFamily: "'Share Tech Mono',monospace", fontSize: 11,
            color: GOLD, letterSpacing: '0.04em',
          }}>
            Need help? Open TSP.gov →
          </span>
        </a>

        <div className="flex-1" />
      </div>

      {/* Fixed bottom button — always above safe area */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        padding: '16px 20px',
        paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
        background: `linear-gradient(to top, #08080a 60%, transparent)`,
        zIndex: 9999,
      }}>
        <ObButton onClick={onNext} disabled={!canContinue}>
          CONTINUE &nbsp;<ChevronRight className="w-4 h-4" />
        </ObButton>
      </div>
    </div>
  );
}
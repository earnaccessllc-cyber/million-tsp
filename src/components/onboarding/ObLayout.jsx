import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import ObShield from './ObShield';
import { BG, GOLD, GOLD_GRADIENT, GOLD_BRIGHT } from './ob-constants';

/* ── Top progress bar ── */
export function ObProgressBar({ pct }) {
  return (
    <div className="w-full h-1" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${GOLD_BRIGHT}, ${GOLD})` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ── Step dots ── */
export function ObStepDots({ current, total = 4 }) {
  const steps = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {steps.map((n, i) => {
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300"
              style={{
                background: active ? GOLD : done ? 'rgba(201,168,50,0.25)' : 'transparent',
                borderColor: active || done ? GOLD : 'rgba(255,255,255,0.18)',
                color: active ? '#000' : done ? GOLD : 'rgba(255,255,255,0.25)',
                fontFamily: "'Orbitron', monospace",
              }}
            >
              {done ? '✓' : n}
            </div>
            {i < steps.length - 1 && (
              <div
                className="h-px w-6 transition-all duration-500"
                style={{ background: n < current ? GOLD : 'rgba(255,255,255,0.1)' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Mini top logo ── */
export function ObMiniLogo() {
  return (
    <div className="flex items-center gap-2 py-3 px-5">
      <ObShield size={28} />
      <div className="flex flex-col leading-none">
        <span style={{
          fontFamily: "'Exo 2',sans-serif", fontSize: 14, fontWeight: 900,
          background: GOLD_GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          letterSpacing: '0.06em',
        }}>MillionTSP</span>
      </div>
    </div>
  );
}

/* ── Back button ── */
export function ObBack({ onBack }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1 py-1 px-2 rounded-lg transition-colors"
      style={{ color: GOLD, background: 'transparent' }}
    >
      <ChevronLeft className="w-4 h-4" />
      <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: GOLD }}>BACK</span>
    </button>
  );
}

/* ── Gold action button ── */
export function ObButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 transition-all duration-200 active:scale-95"
      style={{
        height: 56,
        borderRadius: 10,
        fontFamily: "'Orbitron',monospace",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.12em',
        background: disabled ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)',
        color: disabled ? 'rgba(255,255,255,0.18)' : '#000',
        border: disabled ? '1.5px solid rgba(255,255,255,0.1)' : 'none',
        boxShadow: disabled ? 'none' : '0 4px 16px rgba(201,168,50,0.3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </button>
  );
}

/* ── Section label ── */
export function ObSectionLabel({ children }) {
  return (
    <div className="pt-3 pb-1.5">
      <span style={{
        fontFamily: "'Share Tech Mono',monospace", fontSize: 10,
        color: '#999999', letterSpacing: '0.2em', textTransform: 'uppercase',
      }}>{children}</span>
    </div>
  );
}

/* ── Slide wrapper ── */
export function ObSlide({ stepKey, dir, children }) {
  return (
    <motion.div
      key={stepKey}
      custom={dir}
      variants={{
        enter: d => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: d => ({ x: d > 0 ? -50 : 50, opacity: 0 }),
      }}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.26, ease: 'easeInOut' }}
      className="flex flex-col h-full"
    >
      {children}
    </motion.div>
  );
}
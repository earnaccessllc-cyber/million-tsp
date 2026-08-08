import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState(0);
  // phase 0: shield fades in
  // phase 1: bars rise
  // phase 2: arrow draws
  // phase 3: text fades up
  // phase 4: done

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1100),
      setTimeout(() => setPhase(3), 1600),
      setTimeout(() => setPhase(4), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 4 && onComplete) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

  const px = 160;

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'radial-gradient(ellipse at center, #0d0d00 0%, #08080a 70%)' }}
        >
          {/* Gold radial glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: phase >= 0 ? 1 : 0, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute"
            style={{
              width: 340,
              height: 340,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(201,168,50,0.25) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Animated Shield SVG */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75, y: 20 }}
            animate={{ opacity: phase >= 0 ? 1 : 0, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <svg width={px} height={px} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splash-sg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e2240" />
                  <stop offset="100%" stopColor="#0a0e20" />
                </linearGradient>
                <linearGradient id="splash-bg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE566" />
                  <stop offset="100%" stopColor="#8B6914" />
                </linearGradient>
                <linearGradient id="splash-bar" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#8B6914" />
                </linearGradient>
                <filter id="splash-glow">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#C9A832" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* Shield border */}
              <path
                d="M32 4 L58 14 L58 34 C58 48 46 58 32 62 C18 58 6 48 6 34 L6 14 Z"
                fill="url(#splash-bg)"
                filter="url(#splash-glow)"
              />
              {/* Shield body */}
              <path
                d="M32 7.5 L55 16.5 L55 34 C55 46.5 44.5 56 32 59.5 C19.5 56 9 46.5 9 34 L9 16.5 Z"
                fill="url(#splash-sg)"
              />

              {/* Bar 1 — short, rises from bottom */}
              <motion.rect
                x="16" rx="1.2" width="6"
                initial={{ y: 42, height: 0 }}
                animate={phase >= 1 ? { y: 33, height: 9 } : { y: 42, height: 0 }}
                transition={{ duration: 0.35, delay: 0, ease: 'easeOut' }}
                fill="url(#splash-bar)"
              />
              {/* Bar 2 — medium */}
              <motion.rect
                x="25" rx="1.2" width="6"
                initial={{ y: 42, height: 0 }}
                animate={phase >= 1 ? { y: 26, height: 16 } : { y: 42, height: 0 }}
                transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                fill="url(#splash-bar)"
              />
              {/* Bar 3 — tall */}
              <motion.rect
                x="34" rx="1.2" width="6"
                initial={{ y: 42, height: 0 }}
                animate={phase >= 1 ? { y: 18, height: 24 } : { y: 42, height: 0 }}
                transition={{ duration: 0.35, delay: 0.2, ease: 'easeOut' }}
                fill="url(#splash-bar)"
              />

              {/* Arrow — draws itself with pathLength */}
              <motion.line
                x1="15" y1="42" x2="44" y2="16"
                stroke="white" strokeWidth="2.4" strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={phase >= 2 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
              />
              <motion.polyline
                points="36,14 44,16 42,24"
                fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.35 }}
              />

              {/* M$P label */}
              <motion.text
                x="32" y="54"
                textAnchor="middle"
                fontSize="7" fontWeight="700"
                fontFamily="'Rajdhani', sans-serif"
                fill="#FFD700"
                letterSpacing="0.5"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.5 }}
              >
                M$P
              </motion.text>
            </svg>
          </motion.div>

          {/* Text: MillionTSP */}
          <motion.div
            className="flex flex-col items-center mt-6"
            initial={{ opacity: 0, y: 18 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span
              style={{
                fontFamily: "'Exo 2', sans-serif",
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '0.06em',
                lineHeight: 1,
                background: 'linear-gradient(135deg, #FFE566 0%, #FFD700 40%, #C9A832 70%, #8B6914 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: 'none',
              }}
            >
              MillionTSP
            </span>
            <span
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontSize: 10,
                fontWeight: 500,
                color: '#6B4F0A',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                marginTop: 6,
              }}
            >
              Federal Wealth Builder
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
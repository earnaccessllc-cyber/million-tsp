import React from 'react';
import { motion } from 'framer-motion';

// Standalone animated shield for onboarding — no external deps
export default function ObShield({ size = 120, pulse = false }) {
  const Wrap = pulse ? motion.div : 'div';
  const pulseProps = pulse ? {
    animate: {
      filter: [
        'drop-shadow(0 0 8px rgba(201,168,50,0.4))',
        'drop-shadow(0 0 22px rgba(255,215,0,0.75))',
        'drop-shadow(0 0 8px rgba(201,168,50,0.4))',
      ],
    },
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  } : {};

  return (
    <Wrap {...pulseProps}>
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ob-sg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e2240" />
            <stop offset="100%" stopColor="#0a0e20" />
          </linearGradient>
          <linearGradient id="ob-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE566" />
            <stop offset="100%" stopColor="#8B6914" />
          </linearGradient>
          <linearGradient id="ob-bar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#8B6914" />
          </linearGradient>
        </defs>
        {/* Border */}
        <path d="M32 4 L58 14 L58 34 C58 48 46 58 32 62 C18 58 6 48 6 34 L6 14 Z" fill="url(#ob-bg)" />
        {/* Body */}
        <path d="M32 7.5 L55 16.5 L55 34 C55 46.5 44.5 56 32 59.5 C19.5 56 9 46.5 9 34 L9 16.5 Z" fill="url(#ob-sg)" />
        {/* Bars */}
        <rect x="16" y="33" width="6" height="9" rx="1.2" fill="url(#ob-bar)" />
        <rect x="25" y="26" width="6" height="16" rx="1.2" fill="url(#ob-bar)" />
        <rect x="34" y="18" width="6" height="24" rx="1.2" fill="url(#ob-bar)" />
        {/* Arrow */}
        <line x1="15" y1="42" x2="44" y2="16" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <polyline points="36,14 44,16 42,24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* $1M */}
        <text x="32" y="54" textAnchor="middle" fontSize="7" fontWeight="700" fontFamily="'Rajdhani',sans-serif" fill="#FFD700" letterSpacing="0.5">$1M</text>
      </svg>
    </Wrap>
  );
}
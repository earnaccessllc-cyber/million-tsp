import React from 'react';

// Sizes: 'sm' (32px), 'md' (48px), 'lg' (80px), 'xl' (120px), 'splash' (160px)
const SIZE_MAP = { sm: 32, md: 48, lg: 80, xl: 120, splash: 160 };

export default function TSPShieldLogo({ size = 'md', className = '', animated = false }) {
  const px = SIZE_MAP[size] || size;
  const showLabel = px >= 48;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`sg-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e2240" />
          <stop offset="100%" stopColor="#0a0e20" />
        </linearGradient>
        <linearGradient id={`bg-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE566" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id={`bar-${size}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <radialGradient id={`glow-${size}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#C9A832" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#C9A832" stopOpacity="0" />
        </radialGradient>
        <filter id={`shadow-${size}`}>
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#C9A832" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Radial glow behind shield */}
      <ellipse cx="32" cy="34" rx="26" ry="26" fill={`url(#glow-${size})`} />

      {/* Shield border (gold) */}
      <path
        d="M32 4 L58 14 L58 34 C58 48 46 58 32 62 C18 58 6 48 6 34 L6 14 Z"
        fill={`url(#bg-${size})`}
        filter={`url(#shadow-${size})`}
      />

      {/* Shield body (dark navy) */}
      <path
        d="M32 7.5 L55 16.5 L55 34 C55 46.5 44.5 56 32 59.5 C19.5 56 9 46.5 9 34 L9 16.5 Z"
        fill={`url(#sg-${size})`}
      />

      {/* Bar 1 — short */}
      <rect x="16" y="33" width="6" height="9" rx="1.2" fill={`url(#bar-${size})`} />

      {/* Bar 2 — medium */}
      <rect x="25" y="26" width="6" height="16" rx="1.2" fill={`url(#bar-${size})`} />

      {/* Bar 3 — tall */}
      <rect x="34" y="18" width="6" height="24" rx="1.2" fill={`url(#bar-${size})`} />

      {/* Arrow line */}
      <line
        x1="15" y1="42"
        x2="44" y2="16"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Arrowhead */}
      <polyline
        points="36,14 44,16 42,24"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* M$ label at bottom of shield */}
      {showLabel && (
        <text
          x="32"
          y="54"
          textAnchor="middle"
          fontSize="7"
          fontWeight="700"
          fontFamily="'Rajdhani', sans-serif"
          fill="#FFD700"
          letterSpacing="0.5"
        >
          M$P
        </text>
      )}
    </svg>
  );
}
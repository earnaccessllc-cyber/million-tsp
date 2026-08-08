import React from 'react';
import TSPShieldLogo from './TSPShieldLogo';

// Sizes: 'sm' (header), 'md', 'lg' (splash)
export default function TSPWordmark({ size = 'sm', showIcon = true }) {
  const gradientStyle = {
    background: 'linear-gradient(135deg, #FFE566 0%, #FFD700 40%, #C9A832 70%, #8B6914 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        {showIcon && <TSPShieldLogo size="sm" />}
        <span
          style={{
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 17,
            fontWeight: 900,
            letterSpacing: '0.08em',
            ...gradientStyle,
          }}
        >
          Million<span style={{ ...gradientStyle, fontWeight: 900, fontFamily: "'Exo 2', sans-serif", fontSize: 17 }}>TSP</span>
        </span>
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center gap-3">
        {showIcon && <TSPShieldLogo size="xl" />}
        <span
          style={{
            fontFamily: "'Exo 2', sans-serif",
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: '0.06em',
            lineHeight: 1,
            ...gradientStyle,
          }}
        >
          Million<span style={{ ...gradientStyle }}>TSP</span>
        </span>
      </div>
    );
  }

  // md
  return (
    <div className="flex flex-col items-center gap-2">
      {showIcon && <TSPShieldLogo size="lg" />}
      <span
        style={{
          fontFamily: "'Exo 2', sans-serif",
          fontSize: 30,
          fontWeight: 900,
          letterSpacing: '0.06em',
          lineHeight: 1,
          ...gradientStyle,
        }}
      >
        MillionTSP
      </span>
    </div>
  );
}
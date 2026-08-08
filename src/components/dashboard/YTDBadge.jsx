import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';

export default function YTDBadge({ percent, label, size = 'lg', baselineDate, baselineSource }) {
  const [showTip, setShowTip] = useState(false);
  if (percent == null || isNaN(percent)) return null;
  const positive = percent >= 0;
  const isLarge = size === 'lg';

  const tooltipText = baselineDate
    ? `Calculated as (Current Balance − Jan 1 Balance) ÷ Jan 1 Balance. Baseline: ${baselineDate}${baselineSource ? ` (${baselineSource})` : ''}.`
    : 'YTD = (Current − Opening) ÷ Opening. Opening balance auto-fetched from TSP.gov historical data.';

  return (
    <span className="relative inline-flex items-center">
      <span className={`inline-flex items-center gap-1 font-bold rounded-full ${positive ? 'bg-gain/15 text-gain' : 'bg-loss/15 text-loss'} ${isLarge ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'}`}>
        {positive
          ? <TrendingUp className={isLarge ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          : <TrendingDown className={isLarge ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
        }
        {positive ? '+' : ''}{percent.toFixed(2)}% YTD
        {label && <span className="font-normal opacity-70 ml-0.5">({label})</span>}
        <button
          onClick={e => { e.stopPropagation(); setShowTip(t => !t); }}
          className={`opacity-50 hover:opacity-100 transition-opacity ml-0.5 ${positive ? 'text-gain' : 'text-loss'}`}
        >
          <Info className={isLarge ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
        </button>
      </span>
      {showTip && (
        <span className="absolute bottom-full left-0 mb-2 z-50 bg-popover border border-border text-popover-foreground text-[10px] rounded-lg p-2.5 w-64 shadow-lg font-normal leading-relaxed">
          {tooltipText}
          <button onClick={() => setShowTip(false)} className="block mt-1 text-muted-foreground hover:text-foreground">✕ close</button>
        </span>
      )}
    </span>
  );
}
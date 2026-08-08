import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Info } from 'lucide-react';
import { getMRA } from '@/lib/tspFunds';

// Risk scores per fund (1-10)
const FUND_RISK = {
  'G Fund': 1, 'F Fund': 3, 'C Fund': 7, 'S Fund': 9, 'I Fund': 8,
  'L Income': 2, 'L 2025': 3, 'L 2030': 4, 'L 2035': 5,
  'L 2040': 6, 'L 2045': 6, 'L 2050': 7, 'L 2055': 8, 'L 2060': 8, 'L 2065': 8,
};
const FUND_RISK_DESC = {
  'G Fund': 'Government bonds — virtually no market risk',
  'F Fund': 'Bond index — low volatility, interest rate risk',
  'C Fund': 'S&P 500 — moderate-high market exposure',
  'S Fund': 'Small-cap stocks — high volatility, high growth potential',
  'I Fund': 'International stocks — currency + geopolitical risk',
};

export default function VolatilityScore({ funds, profile }) {
  if (!funds || funds.length === 0) {
    return <div className="bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground text-center">Select funds to see your volatility score.</div>;
  }

  const totalAlloc = funds.reduce((s, f) => s + (f.allocation_percent || 0), 0);
  const score = totalAlloc > 0
    ? funds.reduce((s, f) => s + (FUND_RISK[f.fund_name] || 5) * (f.allocation_percent || 0), 0) / totalAlloc
    : 5;

  const rounded = Math.round(score * 10) / 10;

  const label = score <= 3 ? 'Conservative' : score <= 6 ? 'Moderate' : 'Aggressive';
  const color = score <= 3 ? 'text-gain' : score <= 6 ? 'text-yellow-400' : 'text-loss';
  const barColor = score <= 3 ? 'bg-gain' : score <= 6 ? 'bg-yellow-400' : 'bg-loss';

  const currentAge = profile?.date_of_birth
    ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
    : null;
  const yearsToRetire = currentAge ? Math.max(0, 62 - currentAge) : null;
  let recommended = 5;
  if (yearsToRetire !== null) {
    if (yearsToRetire > 25) recommended = 8;
    else if (yearsToRetire > 15) recommended = 6;
    else if (yearsToRetire > 5) recommended = 4;
    else recommended = 2;
  }

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="bg-card rounded-xl border border-border p-5 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Volatility Score</p>
        <div className={`text-6xl font-black mb-1 ${color}`}>{rounded}</div>
        <div className={`text-sm font-bold ${color}`}>{label}</div>
        <div className="mt-4 bg-muted rounded-full h-3 relative overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gain/30" />
            <div className="flex-1 bg-yellow-400/30" />
            <div className="flex-1 bg-loss/30" />
          </div>
          <motion.div
            initial={{ left: 0 }}
            animate={{ left: `calc(${((rounded - 1) / 9) * 100}% - 6px)` }}
            className="absolute top-0 w-3 h-3 bg-foreground rounded-full shadow-lg"
            style={{ position: 'absolute' }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>Conservative</span><span>Moderate</span><span>Aggressive</span>
        </div>
        {yearsToRetire !== null && (
          <div className="mt-3 text-xs text-muted-foreground">
            Recommended for <span className="text-foreground font-medium">{yearsToRetire}y to retirement</span>:
            <span className={`font-bold ml-1 ${recommended <= 3 ? 'text-gain' : recommended <= 6 ? 'text-yellow-400' : 'text-loss'}`}>{recommended}/10</span>
            {Math.abs(rounded - recommended) > 2 && (
              <span className="ml-1 text-yellow-400">(consider rebalancing)</span>
            )}
          </div>
        )}
      </div>

      {/* Fund breakdown */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fund Risk Breakdown</h3>
        {funds.map(fund => {
          const risk = FUND_RISK[fund.fund_name] || 5;
          const desc = FUND_RISK_DESC[fund.fund_name] || 'Lifecycle fund — auto-adjusts over time';
          const riskColor = risk <= 3 ? 'bg-gain' : risk <= 6 ? 'bg-yellow-400' : 'bg-loss';
          return (
            <div key={fund.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{fund.fund_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{fund.allocation_percent || 0}%</span>
                  <span className="text-xs font-bold">Risk: {risk}/10</span>
                </div>
              </div>
              <div className="bg-muted rounded-full h-1.5">
                <div className={`${riskColor} h-1.5 rounded-full`} style={{ width: `${risk * 10}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">{desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
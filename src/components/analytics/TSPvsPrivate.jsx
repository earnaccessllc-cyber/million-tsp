import React from 'react';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/tspFunds';
import { Award } from 'lucide-react';

// TSP expense ratio vs avg 401k
const TSP_EXPENSE = 0.042; // %
const AVG_401K_EXPENSE = 0.75; // %

const COMPARISONS = [
  { tspFund: 'C Fund', benchmark: 'S&P 500 (SPY)', tspYTD: null, benchYTD: null, note: 'Tracks S&P 500 — nearly identical performance' },
  { tspFund: 'S Fund', benchmark: 'Russell 2000 (IWM)', tspYTD: null, benchYTD: null, note: 'Small-cap US stocks' },
  { tspFund: 'I Fund', benchmark: 'MSCI EAFE (EFA)', tspYTD: null, benchYTD: null, note: 'International developed markets' },
  { tspFund: 'G Fund', benchmark: '10-Year Treasury', tspYTD: null, benchYTD: null, note: 'Short-term gov bonds — G Fund is unique (no price risk)' },
  { tspFund: 'F Fund', benchmark: 'US Aggregate Bond (AGG)', tspYTD: null, benchYTD: null, note: 'Broad US bond market' },
];

export default function TSPvsPrivate({ funds }) {
  const { isPro } = useProStatus();
  if (!isPro) return <ProGate feature="tsp_vs_private" />;

  const totalBalance = funds.reduce((s, f) => s + (f.balance || 0), 0);
  const yearlyFeeSavings = totalBalance * (AVG_401K_EXPENSE - TSP_EXPENSE) / 100;
  const tenYearSavings = yearlyFeeSavings * 10;

  const feeData = [
    { name: 'TSP', expense: TSP_EXPENSE, color: 'hsl(var(--primary))' },
    { name: 'Avg 401k', expense: AVG_401K_EXPENSE, color: 'hsl(var(--muted-foreground))' },
  ];

  return (
    <div className="space-y-4">
      {/* Fee Advantage */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">TSP Fee Advantage</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-primary/10 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">TSP expense ratio</p>
            <p className="text-xl font-bold text-primary">{TSP_EXPENSE}%</p>
          </div>
          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Avg 401k expense</p>
            <p className="text-xl font-bold">{AVG_401K_EXPENSE}%</p>
          </div>
          <div className="bg-gain/10 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">You save/year</p>
            <p className="text-base font-bold text-gain">{formatCurrency(yearlyFeeSavings)}</p>
          </div>
          <div className="bg-gain/10 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">10-year savings</p>
            <p className="text-base font-bold text-gain">{formatCurrency(tenYearSavings)}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">TSP has among the lowest expense ratios of any retirement plan in the world — a significant advantage over private sector 401k plans.</p>
      </div>

      {/* Benchmark Comparisons */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-semibold">TSP vs Benchmarks</h3>
        <p className="text-xs text-muted-foreground">TSP funds track major market indices. Performance is nearly identical to benchmarks before fees — but you pay far less.</p>
        {COMPARISONS.map((c, i) => (
          <div key={i} className="py-2 border-b border-border last:border-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold">{c.tspFund}</span>
              <span className="text-xs text-muted-foreground">vs {c.benchmark}</span>
            </div>
            <p className="text-xs text-muted-foreground">{c.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
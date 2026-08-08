import React, { useState } from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { TrendingDown, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function buildProjection(balance, nominalReturn, inflationRate, years) {
  const data = [];
  let nom = balance, real = balance;
  const currentYear = new Date().getFullYear();
  for (let y = 0; y <= years; y++) {
    data.push({
      year: currentYear + y,
      nominal: Math.round(nom),
      real: Math.round(real),
    });
    nom *= (1 + nominalReturn / 100);
    real *= (1 + (nominalReturn - inflationRate) / 100);
  }
  return data;
}

export default function InflationAdjusted({ profile, totalBalance }) {
  const [inflation, setInflation] = useState(3);

  const annualReturn = profile.fixed_annual_return || 7;
  const currentAge = profile.date_of_birth
    ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
    : null;
  const yearsToRetirement = currentAge ? Math.max(1, 62 - currentAge) : 20;

  const data = buildProjection(totalBalance, annualReturn, inflation, yearsToRetirement);
  const nominalAtRetirement = data[data.length - 1]?.nominal || 0;
  const realAtRetirement = data[data.length - 1]?.real || 0;
  const purchasingPowerLoss = nominalAtRetirement - realAtRetirement;

  // FERS COLA: roughly inflation - 1% (if inflation > 2%)
  const fersCola = Math.max(0, inflation - 1);
  const csrsCola = inflation;
  const cola = profile.retirement_system === 'CSRS' ? csrsCola : fersCola;

  // SS COLA = CPI
  const ssMonthly = profile.ss_monthly_benefit || 0;

  return (
    <div className="space-y-4">
      {/* Control */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Inflation-Adjusted Balance</h3>
          </div>
          <span className="text-sm font-bold text-primary">{inflation}% CPI</span>
        </div>
        <Slider min={1} max={8} step={0.5} value={[inflation]} onValueChange={([v]) => setInflation(v)} />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
          <span>1% (low)</span><span>4% (avg)</span><span>8% (high)</span>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Nominal at retirement</p>
          <p className="text-base font-bold">{formatCurrency(nominalAtRetirement)}</p>
          <p className="text-[10px] text-muted-foreground">(what the number says)</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">Real purchasing power</p>
          <p className="text-base font-bold text-loss">{formatCurrency(realAtRetirement)}</p>
          <p className="text-[10px] text-muted-foreground">(in today's dollars)</p>
        </div>
      </div>

      <div className="bg-loss/10 border border-loss/20 rounded-xl p-3">
        <p className="text-xs font-semibold text-loss">Inflation will erode {formatCurrency(purchasingPowerLoss)} of your balance's purchasing power over {yearsToRetirement} years at {inflation}% CPI.</p>
      </div>

      {/* Chart */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Nominal vs Real Balance</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <XAxis dataKey="year" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} interval={Math.floor(yearsToRetirement / 4)} />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
              formatter={v => [formatCurrency(v)]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="nominal" name="Nominal" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="real" name="Real (today's $)" stroke="hsl(var(--loss))" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* COLA info */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">COLA Impact</h3>
        <div className="flex justify-between items-center py-1.5 border-b border-border">
          <span className="text-sm">{profile.retirement_system || 'FERS'} Pension COLA</span>
          <span className="text-sm font-semibold text-gain">+{cola.toFixed(1)}%/yr</span>
        </div>
        {ssMonthly > 0 && (
          <div className="flex justify-between items-center py-1.5 border-b border-border">
            <span className="text-sm">Social Security COLA</span>
            <span className="text-sm font-semibold text-gain">+{inflation.toFixed(1)}%/yr</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          {profile.retirement_system === 'CSRS'
            ? 'CSRS pensions receive full CPI COLA annually.'
            : `FERS pensions receive CPI minus 1% when inflation > 2% (${fersCola.toFixed(1)}% at ${inflation}% CPI).`}
        </p>
      </div>
    </div>
  );
}
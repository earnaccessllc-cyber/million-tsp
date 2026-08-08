import React from 'react';
import { calcRetirement, getFRALabel } from '@/lib/retirementCalc';
import { formatCurrency } from '@/lib/tspFunds';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function fmt(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function PhaseCard({ phase, color, index, isCSRS }) {
  if (!phase) return null;
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Phase {index}</span>
        <span className="text-[10px] text-muted-foreground">{fmt(phase.startDate)} → {phase.endDate ? fmt(phase.endDate) : 'Onward'}</span>
      </div>
      <p className="text-xs font-medium mb-2">{phase.label}</p>
      <div className="space-y-1 mb-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Pension</span>
          <span>{formatCurrency(phase.pension)}</span>
        </div>
        {phase.srs > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">SRS</span>
            <span>{formatCurrency(phase.srs)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">TSP Withdrawal</span>
          <span>{formatCurrency(phase.tsp)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Social Security</span>
          <span>
            {phase.ss > 0
              ? formatCurrency(phase.ss)
              : <span className="text-muted-foreground/50">{isCSRS ? '$0 — CSRS service isn\'t SS-covered' : '$0 — not started'}</span>}
          </span>
        </div>
      </div>
      <div className="flex justify-between border-t border-border/50 pt-2">
        <span className="text-sm font-bold">Monthly Total</span>
        <span className="text-sm font-bold text-primary">{formatCurrency(phase.total)}</span>
      </div>
    </div>
  );
}

const phaseColors = [
  'border-primary/30 bg-primary/5',
  'border-chart-3/30 bg-chart-3/5',
  'border-gain/30 bg-gain/5',
];

export default function IncomeTimeline({ profile, tspBalance }) {
  const result = calcRetirement(profile, tspBalance);
  if (!result) return null;

  const { phase1Income, phase2Income, phase3Income, adjustedSSBenefit, ssClaimingAge, fra, birthYear } = result;

  // Chart data
  const phases = [phase1Income, phase2Income, phase3Income].filter(Boolean);
  const chartData = phases.map((p, i) => ({
    name: `Phase ${i + 1}`,
    pension: Math.round(p.pension),
    srs: Math.round(p.srs),
    tsp: Math.round(p.tsp),
    ss: Math.round(p.ss),
  }));

  const fraLabel = birthYear ? getFRALabel(birthYear) : 'FRA';
  const ssDiff = ssClaimingAge - fra;
  const ssDiffAbs = Math.abs(ssDiff);
  const ssAdjPct = ssDiff === 0 ? 0 : ssDiff < 0
    ? -(ssDiffAbs * 12 * 0.556)
    : Math.min(ssDiffAbs * 8, (70 - fra) * 8);

  return (
    <div className="space-y-4">
      {/* SS Adjustment Info — CSRS employment isn't Social Security-covered, so this never applies to CSRS */}
      {profile?.retirement_system !== 'CSRS' && profile?.ss_monthly_benefit > 0 && (
        <div className="p-3 bg-card rounded-xl border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Social Security Adjustment</p>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Claiming age</span>
            <span className="font-medium">Age {ssClaimingAge.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Your {fraLabel}</span>
            <span>Base: {formatCurrency(profile.ss_monthly_benefit)}/mo</span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-border pt-2 mt-2">
            <span className="font-medium">Adjusted Benefit</span>
            <span className={`font-bold ${ssDiff >= 0 ? 'text-gain' : 'text-loss'}`}>
              {formatCurrency(adjustedSSBenefit)}/mo
              {ssDiff !== 0 && (
                <span className="ml-1 text-[10px]">
                  ({ssDiff > 0 ? '+' : ''}{ssAdjPct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Phase Cards */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly Income by Phase</p>
        {phases.map((phase, i) => (
          <PhaseCard key={i} phase={phase} color={phaseColors[i]} index={i + 1} isCSRS={profile?.retirement_system === 'CSRS'} />
        ))}
      </div>

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <div className="p-4 bg-card rounded-xl border border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Income Comparison</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(val) => formatCurrency(val)} />
              <Bar dataKey="pension" stackId="a" fill="hsl(var(--primary))" name="Pension" radius={[0,0,0,0]} />
              <Bar dataKey="srs" stackId="a" fill="hsl(var(--chart-2))" name="SRS" />
              <Bar dataKey="tsp" stackId="a" fill="hsl(var(--chart-3))" name="TSP" />
              <Bar dataKey="ss" stackId="a" fill="hsl(var(--gain))" name="SS" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
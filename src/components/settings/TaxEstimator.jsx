import React, { useState } from 'react';
import ProGate from '@/components/common/ProGate';
import { useProStatus } from '@/lib/proGating';
import { useProfile } from '@/context/ProfileContext';
import { formatCurrency } from '@/lib/tspFunds';
import { Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TAX_BRACKETS_2024 = [
  { min: 0, max: 11600, rate: 10 },
  { min: 11600, max: 47150, rate: 12 },
  { min: 47150, max: 100525, rate: 22 },
  { min: 100525, max: 191950, rate: 24 },
  { min: 191950, max: 243725, rate: 32 },
  { min: 243725, max: 609350, rate: 35 },
  { min: 609350, max: Infinity, rate: 37 },
];

function calcTax(income) {
  let tax = 0;
  for (const bracket of TAX_BRACKETS_2024) {
    if (income <= bracket.min) break;
    const taxable = Math.min(income, bracket.max) - bracket.min;
    tax += taxable * (bracket.rate / 100);
  }
  return tax;
}

function calcRMD(balance, age) {
  const factors = { 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2 };
  const factor = factors[age] || 19;
  return balance / factor;
}

export default function TaxEstimator() {
  const { isPro, loading: planLoading } = useProStatus();
  const { activeProfile } = useProfile();
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [state, setState] = useState('');

  // Nothing at all until the plan is known — showing the gate first would
  // flash an upsell at a trial or paid user on every mount.
  if (planLoading) return null;
  if (!isPro) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Tax Estimator</h3>
        </div>
        <ProGate feature="tax_estimator" />
      </div>
    );
  }

  const withdrawal = parseFloat(withdrawalAmount) || 0;
  const other = parseFloat(otherIncome) || 0;
  const totalIncome = withdrawal + other;

  const taxOnTotal = calcTax(totalIncome);
  const taxWithout = calcTax(other);
  const marginalTax = taxOnTotal - taxWithout;
  const effectiveRate = totalIncome > 0 ? (taxOnTotal / totalIncome) * 100 : 0;

  const currentAge = activeProfile?.date_of_birth
    ? new Date().getFullYear() - new Date(activeProfile.date_of_birth).getFullYear()
    : null;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Tax Estimator (Pro)</h3>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">TSP Withdrawal/yr</Label>
          <Input type="number" value={withdrawalAmount} onChange={e => setWithdrawalAmount(e.target.value)} placeholder="e.g. 40000" className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Other Income/yr</Label>
          <Input type="number" value={otherIncome} onChange={e => setOtherIncome(e.target.value)} placeholder="Pension, SS..." className="mt-1 h-8 text-sm" />
        </div>
      </div>

      {withdrawal > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Tax on withdrawal</p>
              <p className="text-base font-bold text-loss">{formatCurrency(marginalTax)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Effective tax rate</p>
              <p className="text-base font-bold">{effectiveRate.toFixed(1)}%</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">After-tax withdrawal</p>
              <p className="text-base font-bold text-gain">{formatCurrency(withdrawal - marginalTax)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total income</p>
              <p className="text-base font-bold">{formatCurrency(totalIncome)}</p>
            </div>
          </div>

          <div className="bg-muted rounded-xl p-3">
            <p className="text-xs font-semibold mb-1">Traditional vs Roth Comparison</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Traditional TSP</p>
                <p className="text-xs">Pay tax at withdrawal. Better if you expect lower bracket in retirement.</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Roth TSP</p>
                <p className="text-xs text-gain">Tax-free growth. Better if you expect higher bracket in retirement.</p>
              </div>
            </div>
          </div>

          {currentAge && currentAge >= 70 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-xs font-semibold text-yellow-400 mb-1">RMD Required at Age 73</p>
              <p className="text-xs text-muted-foreground">
                You'll be required to withdraw a minimum amount starting at 73 regardless of need.
              </p>
            </div>
          )}

          {currentAge && currentAge < 70 && (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs font-semibold mb-1">Required Minimum Distribution (RMD)</p>
              <p className="text-xs text-muted-foreground">Starting at age 73, RMDs are required. At 73 with a $500k balance, estimated RMD: {formatCurrency(calcRMD(500000, 73))}/yr.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
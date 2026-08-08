import React, { useState } from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, DollarSign } from 'lucide-react';

function calcMonthlyPayment(principal, annualRate, months) {
  if (months <= 0 || principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function projectBalance(balance, annualReturn, years) {
  return balance * Math.pow(1 + annualReturn / 100, years);
}

export default function TSPLoanCalculator({ profile, tspBalance }) {
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState(5);
  const [loanType, setLoanType] = useState('general'); // general | residential
  const [loanStartDate, setLoanStartDate] = useState('');
  const G_RATE = 3.5; // approximate G Fund rate

  const maxLoan = Math.min(tspBalance * 0.5, 50000);
  const requested = parseFloat(loanAmount) || 0;
  const maxTerm = loanType === 'general' ? 5 : 15;
  const term = Math.min(loanTerm, maxTerm);
  const actualLoan = Math.min(requested, maxLoan);

  const calcEndDate = () => {
    if (!loanStartDate || term <= 0) return null;
    const d = new Date(loanStartDate);
    d.setFullYear(d.getFullYear() + term);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };
  const endDate = calcEndDate();
  const monthlyPayment = calcMonthlyPayment(actualLoan, G_RATE, term * 12);
  const totalPaid = monthlyPayment * term * 12;

  // "True cost" — what the loan amount would grow to at retirement
  const yearsToRetirement = (() => {
    if (!profile.date_of_birth) return 20;
    const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();
    return Math.max(1, 62 - age);
  })();

  const annualReturn = profile.fixed_annual_return || 7;
  const withoutLoanBalance = projectBalance(tspBalance, annualReturn, yearsToRetirement);
  const withLoanBalance = projectBalance(tspBalance - actualLoan, annualReturn, yearsToRetirement);
  const trueCost = withoutLoanBalance - withLoanBalance;
  const tooLow = actualLoan > tspBalance * 0.4;

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">TSP Loan Calculator</h3>
      </div>

      {/* Loan type toggle */}
      <div className="flex gap-2">
        {['general', 'residential'].map(t => (
          <button
            key={t}
            onClick={() => { setLoanType(t); setLoanTerm(Math.min(loanTerm, t === 'general' ? 5 : 15)); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              loanType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {t === 'general' ? 'General (≤5yr)' : 'Residential (≤15yr)'}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Loan Amount</Label>
          <Input
            type="number"
            placeholder={`Max: ${formatCurrency(maxLoan)}`}
            value={loanAmount}
            onChange={e => setLoanAmount(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Term (years, max {maxTerm})</Label>
          <Input
            type="number"
            min={1} max={maxTerm}
            value={loanTerm}
            onChange={e => setLoanTerm(Math.min(maxTerm, Math.max(1, parseInt(e.target.value) || 1)))}
            className="mt-1 h-8 text-sm"
          />
        </div>
        <div className="col-span-2">
          <Label className="text-xs text-muted-foreground">Loan Start Date</Label>
          <Input
            type="date"
            value={loanStartDate}
            onChange={e => setLoanStartDate(e.target.value)}
            className="mt-1 h-8 text-sm"
          />
        </div>
      </div>
      {endDate && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">Payoff Date</span>
          <span className="text-xs font-bold text-primary">{endDate}</span>
        </div>
      )}

      {/* Results */}
      {actualLoan > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Monthly Payment</p>
              <p className="text-base font-bold">{formatCurrency(monthlyPayment)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="text-base font-bold">{G_RATE}% (G Fund)</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total Repaid</p>
              <p className="text-base font-bold">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Interest Paid</p>
              <p className="text-base font-bold">{formatCurrency(totalPaid - actualLoan)}</p>
            </div>
          </div>

          {/* True cost comparison */}
          <div className="bg-loss/10 border border-loss/20 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-loss">True Cost of Loan</p>
            <p className="text-xs text-muted-foreground">What {formatCurrency(actualLoan)} could grow to at retirement:</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Without Loan</p>
                <p className="text-sm font-bold text-gain">{formatCurrency(withoutLoanBalance)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">With Loan</p>
                <p className="text-sm font-bold text-loss">{formatCurrency(withLoanBalance)}</p>
              </div>
            </div>
            <p className="text-xs font-semibold text-loss mt-1">Lost growth: {formatCurrency(trueCost)}</p>
          </div>

          {tooLow && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">This loan leaves your balance quite low. Consider borrowing less to protect your retirement savings.</p>
            </div>
          )}
        </div>
      )}

      {/* Max loan info */}
      <div className="flex items-center justify-between py-2 border-t border-border">
        <span className="text-xs text-muted-foreground">Maximum allowed loan</span>
        <span className="text-xs font-semibold">{formatCurrency(maxLoan)}</span>
      </div>
    </div>
  );
}
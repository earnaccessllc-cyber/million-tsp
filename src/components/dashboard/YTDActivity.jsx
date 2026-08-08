import React from 'react';
import { formatCurrency } from '@/lib/tspFunds';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { calcYTD } from '@/lib/contributionCalc';

export default function YTDActivity({ profile, totalBalance }) {
  const [expanded, setExpanded] = React.useState(false);

  const opening = profile?.opening_balance || 0;
  const ytd = calcYTD(profile);

  // If contributions settings are not configured, fall back to legacy stored values
  const hasNewContribs = !!(profile?.contrib_traditional_percent || profile?.contrib_traditional_dollar || profile?.contrib_roth_percent || profile?.contrib_roth_dollar);

  let tradYTD, rothYTD, matchYTD, auto1YTD, loanYTD, agencyType;

  // retirement_system (Retirement tab) and agency_type (Settings > Contributions) are set
  // independently — a CSRS employee could leave agency_type at its 'usps' default without ever
  // touching that dropdown. CSRS never gets agency match/auto 1%, so it always overrides here.
  const effectiveAgencyType = profile?.retirement_system === 'CSRS' ? 'csrs' : (profile?.agency_type || 'usps');

  if (hasNewContribs) {
    tradYTD = ytd.tradYTD;
    rothYTD = ytd.rothYTD;
    matchYTD = ytd.matchYTD;
    auto1YTD = ytd.auto1YTD;
    loanYTD = ytd.loanYTD;
    agencyType = effectiveAgencyType;
  } else {
    // Legacy fallback
    tradYTD = profile?.traditional_contributions || 0;
    rothYTD = profile?.roth_contributions || 0;
    matchYTD = effectiveAgencyType === 'csrs' ? 0 : (profile?.agency_match || 0);
    auto1YTD = effectiveAgencyType === 'csrs' ? 0 : (profile?.auto_1_percent || 0);
    loanYTD = (profile?.loan_repayments || 0) * 26;
    agencyType = effectiveAgencyType;
  }

  const gainLoss = totalBalance - opening - tradYTD - rothYTD - matchYTD - auto1YTD - loanYTD;
  const isCSRS = agencyType === 'csrs';
  const isStandardFERS = agencyType === 'standard_fers';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mx-4 mt-4"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border"
      >
        <span className="text-sm font-semibold">YTD Activity Summary</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-card border border-t-0 border-border rounded-b-xl -mt-2 pt-4 px-4 pb-4"
        >
          <div className="space-y-2.5">
            <Row label="Opening Balance (Jan 1)" value={opening} />
            <Row label="Traditional Contributions" value={tradYTD} />
            {rothYTD > 0 && <Row label="Roth Contributions" value={rothYTD} />}

            {!isCSRS && (
              <>
                {isStandardFERS && auto1YTD > 0 && (
                  <Row label="Auto 1%" value={auto1YTD} color="text-gain" badge="AUTO" />
                )}
                <Row
                  label={agencyType === 'usps' ? 'Agency Match (incl. auto)' : 'Agency Match'}
                  value={matchYTD}
                  color="text-gain"
                  badge="AUTO"
                />
              </>
            )}

            {loanYTD > 0 && <Row label="Loan Repayments" value={loanYTD} />}

            <Row
              label="Market Gain / Loss"
              value={gainLoss}
              color={gainLoss >= 0 ? 'text-gain' : 'text-loss'}
              prefix={gainLoss >= 0 ? '+' : ''}
            />

            <div className="border-t border-border pt-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold">Closing Balance (Today)</span>
              <span className="text-sm font-bold" style={{ color: '#FFD700' }}>{formatCurrency(totalBalance)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Contributions estimated from pay periods elapsed. Agency match auto-calculated.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

function Row({ label, value, color = 'text-foreground', badge, prefix = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${color} flex items-center gap-1`}>
        {prefix}{formatCurrency(Math.abs(value))}
        {badge && <span className="text-xs bg-gain/20 text-gain px-1 rounded">{badge}</span>}
      </span>
    </div>
  );
}
import React, { useState } from 'react';
import { X, Calendar, TrendingUp, Shield, Zap, Target, Clock, ChevronDown } from 'lucide-react';
import { getTrialStatus } from '@/lib/trialUtils';

// Kept in sync with PaywallScreen's feature list by hand — both are short,
// curated summaries (not the full FEATURES registry in proGating.js), and
// showing the same six lines in both places is what matters here, not a
// shared import.
//
// This list is informational only — no price, no button. See the note below
// and in PlanStatusCard for why: the trial is meant to be used without being
// sold to, and the upsell already lives in PaywallScreen once it expires.
const TRIAL_FEATURES = [
  { icon: Calendar, text: 'Retirement countdown & eligibility' },
  { icon: TrendingUp, text: 'Full daily balance history & YTD activity' },
  { icon: Shield, text: 'Sick leave credits & pension calculator' },
  { icon: Zap, text: 'TSP loan, FIRE calculator & income timeline' },
  { icon: Target, text: 'Contribution optimizer, risk scoring & fund analytics' },
  { icon: Clock, text: 'AI TSP coach, tax estimator & smart rebalancing' },
];

export default function TrialBanner({ profile, onDismiss }) {
  const { isOnTrial, daysRemaining } = getTrialStatus(profile);
  const [expanded, setExpanded] = useState(false);

  if (!isOnTrial) return null;

  const isLastDay = daysRemaining === 1;
  const accent = isLastDay ? '#fed7aa' : '#bbf7d0';

  return (
    <div
      className="sticky top-14 z-30 w-full"
      style={{
        background: isLastDay
          ? 'linear-gradient(90deg, rgba(185,60,20,0.95), rgba(160,40,10,0.95))'
          : 'linear-gradient(90deg, rgba(20,80,30,0.95), rgba(15,65,25,0.95))',
        borderBottom: `1px solid ${isLastDay ? 'rgba(255,120,60,0.4)' : 'rgba(34,197,94,0.3)'}`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between gap-3 cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isLastDay ? (
            <span className="text-xs font-semibold text-orange-200 leading-tight">
              ⚠️ Your free trial ends <strong>tomorrow</strong>
            </span>
          ) : (
            <span className="text-xs font-semibold text-green-200">
              🎉 Free Trial — <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</strong> — full access to everything
            </span>
          )}
          <ChevronDown
            className="w-3 h-3 flex-shrink-0 transition-transform"
            style={{ color: accent, transform: expanded ? 'rotate(180deg)' : 'none' }}
          />
        </div>
        {/* No gold "Get Pro" button here either — see PlanStatusCard. The banner
            says how long is left, which is what someone on a trial needs to know;
            it doesn't sell to them while they are still trying the thing. */}
        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="flex-shrink-0 p-1 opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4 text-green-200" />
          </button>
        )}
      </div>
      {expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2 opacity-70" style={{ color: accent }}>
            What's included in your trial
          </p>
          <div className="space-y-1.5">
            {TRIAL_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
                <span className="text-xs" style={{ color: isLastDay ? '#fff7ed' : '#f0fdf4' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

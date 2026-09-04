import React from 'react';
import { X } from 'lucide-react';
import { getTrialStatus } from '@/lib/trialUtils';

export default function TrialBanner({ profile, onDismiss }) {
  const { isOnTrial, daysRemaining } = getTrialStatus(profile);

  if (!isOnTrial) return null;

  const isLastDay = daysRemaining === 1;

  return (
    <div
      className="sticky top-14 z-30 w-full px-4 py-2 flex items-center justify-between gap-3"
      style={{
        background: isLastDay
          ? 'linear-gradient(90deg, rgba(185,60,20,0.95), rgba(160,40,10,0.95))'
          : 'linear-gradient(90deg, rgba(20,80,30,0.95), rgba(15,65,25,0.95))',
        borderBottom: `1px solid ${isLastDay ? 'rgba(255,120,60,0.4)' : 'rgba(34,197,94,0.3)'}`,
        backdropFilter: 'blur(8px)',
      }}
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
      </div>
      {/* No gold "Get Pro" button here either — see PlanStatusCard. The banner
          says how long is left, which is what someone on a trial needs to know;
          it doesn't sell to them while they are still trying the thing. */}
      {onDismiss && (
        <button onClick={onDismiss} className="flex-shrink-0 p-1 opacity-60 hover:opacity-100">
          <X className="w-4 h-4 text-green-200" />
        </button>
      )}
    </div>
  );
}
import React from 'react';
import { Shield, Clock } from 'lucide-react';
import { getTrialStatus } from '@/lib/trialUtils';

export default function PlanStatusCard({ profile }) {
  const { plan, isOnTrial, daysRemaining } = getTrialStatus(profile);

  if (plan === 'paid') {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'rgba(201,168,50,0.08)', border: '1px solid rgba(201,168,50,0.25)' }}>
        
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(201,168,50,0.15)' }}>
          
          <Shield className="w-4 h-4" style={{ color: '#C9A832' }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: '#C9A832' }}>Pro Member ✅ — Lifetime Access</p>
          <p className="text-xs text-muted-foreground">Full access to all features, forever</p>
        </div>
      </div>);

  }

  // On an active trial there is no upgrade button here.
  //
  // The trial exists to let someone use the whole app without being sold to;
  // putting a gold "Get Lifetime Access" button on the status card meant the
  // pitch was in front of them from the moment they signed up. What is left is
  // the fact they need — how much trial is left — and the upsell returns on its
  // own when the trial expires, via PaywallScreen and the feature gates.
  if (isOnTrial) {
    const isLastDay = daysRemaining === 1;
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: isLastDay ? 'rgba(185,60,20,0.1)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${isLastDay ? 'rgba(185,60,20,0.35)' : 'rgba(34,197,94,0.25)'}`
        }}>
        
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: isLastDay ? 'rgba(185,60,20,0.15)' : 'rgba(34,197,94,0.12)' }}>
            
            <Clock className="w-4 h-4" style={{ color: isLastDay ? '#f97316' : '#22c55e' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: isLastDay ? '#f97316' : '#22c55e' }}>
              Free Trial — {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-muted-foreground">Full access during your trial</p>
          </div>
        </div>
      </div>);

  }

  // Free plan
  return null;
























}
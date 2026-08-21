import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import RetirementInputs from '@/components/retirement/RetirementInputs';
import PensionCalculator from '@/components/retirement/PensionCalculator';
import RetirementCountdown from '@/components/retirement/RetirementCountdown';
import RetirementEligibility from '@/components/retirement/RetirementEligibility';
import IncomeTimeline from '@/components/retirement/IncomeTimeline';
import TSPLoanCalculator from '@/components/retirement/TSPLoanCalculator';
import MillionaireTracker from '@/components/retirement/MillionaireTracker';
import LifeEventsPlanner from '@/components/retirement/LifeEventsPlanner';
import FIRECalculator from '@/components/retirement/FIRECalculator';
import SavingsStreaks from '@/components/retirement/SavingsStreaks';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import OnboardingPrompt from '@/components/onboarding/OnboardingPrompt';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Shield, DollarSign, Clock, Zap } from 'lucide-react';
import UpgradePrompt from '@/components/common/UpgradePrompt';
import { hasFullAccess } from '@/lib/trialUtils';

export default function RetirementEnhanced() {
  const { activeProfile, refreshProfiles } = useProfile();
  // AppLayout keeps every tab mounted in the background (opacity/pointer-events
  // hidden, not unmounted) to preserve scroll position — so a portaled fixed
  // element needs its own check for whether this tab is the one on screen,
  // otherwise it stays visible even while viewing a different tab.
  const location = useLocation();
  const isActiveTab = location.pathname === '/retirement' || location.pathname.startsWith('/retirement/');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingUpdates, setPendingUpdates] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const pendingRef = useRef({});

  const { data: funds = [] } = useQuery({
    queryKey: ['fund-allocations', activeProfile?.id],
    queryFn: () => base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }),
    enabled: !!activeProfile?.id,
  });

  const { data: dailyBalances = [] } = useQuery({
    queryKey: ['daily-balances', activeProfile?.id],
    queryFn: () => base44.entities.DailyBalance.filter({ profile_id: activeProfile.id }, '-date', 365),
    enabled: !!activeProfile?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (updates) => {
      await base44.entities.TSPProfile.update(activeProfile.id, updates);
      setPendingUpdates({});
      pendingRef.current = {};
      refreshProfiles();
    },
    onSuccess: () => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  });

  if (!activeProfile) return <OnboardingPrompt />;

  const mergedProfile = { ...activeProfile, ...pendingUpdates };
  const selectedFunds = funds.filter(f => f.is_selected);
  const fundsBalance = selectedFunds.reduce((sum, f) => sum + (f.balance || 0), 0);
  const mfwBalance = activeProfile?.has_mfw ? (activeProfile?.mfw_balance || 0) : 0;
  const tspBalance = activeProfile?.total_balance_manual
    ? activeProfile.total_balance_manual
    : fundsBalance > 0
      ? (fundsBalance + mfwBalance)
      : (activeProfile?.opening_balance || 0);
  const handleUpdate = (updates) => {
    pendingRef.current = { ...pendingRef.current, ...updates };
    setPendingUpdates(prev => ({ ...prev, ...updates }));
    setSaveStatus('idle');
  };

  return (
    <>
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Retirement</h2>
        </div>

        <Tabs defaultValue="million" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4 h-auto">
            <TabsTrigger value="million" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <DollarSign className="w-3.5 h-3.5" />Goal
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Shield className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Benefits{!hasFullAccess(activeProfile) && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
            <TabsTrigger value="countdown" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Clock className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Countdown{!hasFullAccess(activeProfile) && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Zap className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Tools{!hasFullAccess(activeProfile) && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="million">
            <MillionaireTracker profile={mergedProfile} tspBalance={tspBalance} />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            {!hasFullAccess(activeProfile) ? (
              <UpgradePrompt feature="FERS/CSRS eligibility rules, pension calculator, and income timeline" />
            ) : (
              <>
                <div className="p-4 bg-card rounded-xl border border-border">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Your Information</h3>
                  <RetirementInputs profile={mergedProfile} onUpdate={handleUpdate} />
                </div>
                <RetirementEligibility profile={mergedProfile} />
                <PensionCalculator profile={mergedProfile} tspBalance={tspBalance} />
                <IncomeTimeline profile={mergedProfile} tspBalance={tspBalance} />
              </>
            )}
          </TabsContent>

          <TabsContent value="countdown">
            {!hasFullAccess(activeProfile) ? (
              <UpgradePrompt feature="retirement countdown, savings streaks, and milestone tracking" />
            ) : (
              <div className="space-y-4">
                <RetirementCountdown profile={mergedProfile} />
                <SavingsStreaks dailyBalances={dailyBalances} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {!hasFullAccess(activeProfile) ? (
              <UpgradePrompt feature="TSP loan calculator and planning tools" />
            ) : (
              <TSPLoanCalculator profile={mergedProfile} tspBalance={tspBalance} />
            )}
          </TabsContent>

        </Tabs>
      </motion.div>
    </div>

    {/* Save button — portaled straight to document.body and truly `fixed` to the
        real viewport, so it never moves on scroll. A `fixed` element rendered
        inside the normal component tree doesn't work here: each tab is wrapped
        in a framer-motion div with an animated transform, and a CSS transform on
        ANY ancestor makes `fixed` descendants position relative to that
        transformed ancestor instead of the actual screen — the portal escapes
        that ancestor chain entirely so `fixed` behaves as expected. */}
    {isActiveTab && createPortal(
      <div
        className="fixed left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <Button
          size="lg"
          disabled={saveStatus === 'saving' || saveStatus === 'saved' || Object.keys(pendingUpdates).length === 0}
          onClick={() => {
            const toSave = { ...pendingRef.current };
            if (Object.keys(toSave).length > 0) {
              setSaveStatus('saving');
              saveMutation.mutate(toSave);
            }
          }}
          className="pointer-events-auto w-full max-w-lg gap-2 h-12 text-sm font-bold rounded-xl border-0 disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)',
            color: '#000',
            boxShadow: '0 4px 20px rgba(201,168,50,0.45)',
          }}
        >
          {saveStatus === 'saving' && <><Save className="w-4 h-4 animate-pulse" /> Saving…</>}
          {saveStatus === 'saved' && <><CheckCircle2 className="w-4 h-4" /> Saved</>}
          {saveStatus === 'idle' && <><Save className="w-4 h-4" /> {Object.keys(pendingUpdates).length > 0 ? 'Save Changes' : 'Saved'}</>}
        </Button>
      </div>,
      document.body
    )}
    </>
  );
}
import React, { useState, useRef } from 'react';
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
import { useFeature } from '@/lib/proGating';

export default function RetirementEnhanced() {
  const { activeProfile, refreshProfiles } = useProfile();
  const queryClient = useQueryClient();
  const { allowed: canSeeGoal } = useFeature('goal_tracking');
  const { allowed: canSeeBenefits } = useFeature('retirement_benefits');
  const { allowed: canSeeCountdown } = useFeature('retirement_countdown');
  const { allowed: canSeeTools } = useFeature('retirement_tools');
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
  // Mirrors the Home screen's total exactly (MFW rides on top of the fund-only
  // *and* opening-balance fallbacks) so goal progress/pace match across tabs.
  const tspBalance = activeProfile?.total_balance_manual
    ? activeProfile.total_balance_manual
    : (fundsBalance > 0 ? fundsBalance : (activeProfile?.opening_balance || 0)) + mfwBalance;
  const handleUpdate = (updates) => {
    pendingRef.current = { ...pendingRef.current, ...updates };
    setPendingUpdates(prev => ({ ...prev, ...updates }));
    setSaveStatus('idle');
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Retirement</h2>
          <Button
            size="sm"
            disabled={saveStatus === 'saving' || saveStatus === 'saved' || Object.keys(pendingUpdates).length === 0}
            onClick={() => {
              const toSave = { ...pendingRef.current };
              if (Object.keys(toSave).length > 0) {
                setSaveStatus('saving');
                saveMutation.mutate(toSave);
              }
            }}
            className="gap-1.5 text-xs h-8 px-3 transition-all border-0 disabled:opacity-50"
            style={
              saveStatus === 'saved'
                ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                : {
                    background: 'linear-gradient(135deg, #FFD700 0%, #C9A832 100%)',
                    color: '#000',
                    boxShadow: '0 2px 10px rgba(201,168,50,0.4)',
                  }
            }
          >
            {saveStatus === 'saving' && <><Save className="w-3.5 h-3.5 animate-pulse" /> Saving…</>}
            {saveStatus === 'saved' && <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>}
            {saveStatus === 'idle' && <><Save className="w-3.5 h-3.5" /> {Object.keys(pendingUpdates).length > 0 ? 'Save' : 'Saved'}</>}
          </Button>
        </div>

        <Tabs defaultValue="million" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4 h-auto">
            <TabsTrigger value="million" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Goal{!canSeeGoal && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Shield className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Benefits{!canSeeBenefits && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
            <TabsTrigger value="countdown" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Clock className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Countdown{!canSeeCountdown && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Zap className="w-3.5 h-3.5" />
              <span className="flex items-center gap-0.5">
                Tools{!canSeeTools && <span className="text-[8px] text-yellow-400 font-bold leading-none">🔒</span>}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="million">
            {!canSeeGoal ? (
              <UpgradePrompt feature="goal_tracking" />
            ) : (
              <MillionaireTracker profile={mergedProfile} tspBalance={tspBalance} />
            )}
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            {!canSeeBenefits ? (
              <UpgradePrompt feature="retirement_benefits" />
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
            {!canSeeCountdown ? (
              <UpgradePrompt feature="retirement_countdown" />
            ) : (
              <div className="space-y-4">
                <RetirementCountdown profile={mergedProfile} />
                <SavingsStreaks dailyBalances={dailyBalances} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            {!canSeeTools ? (
              <UpgradePrompt feature="retirement_tools" />
            ) : (
              <TSPLoanCalculator profile={mergedProfile} tspBalance={tspBalance} />
            )}
          </TabsContent>

        </Tabs>
      </motion.div>
    </div>
  );
}

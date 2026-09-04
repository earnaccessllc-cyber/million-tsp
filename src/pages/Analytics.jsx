import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import OnboardingPrompt from '@/components/onboarding/OnboardingPrompt';
import UpgradePrompt from '@/components/common/UpgradePrompt';
import { useFeature } from '@/lib/proGating';
import { getAccountBalance } from '@/lib/accountBalance';
import VolatilityScore from '@/components/analytics/VolatilityScore';
import InflationAdjusted from '@/components/analytics/InflationAdjusted';
import ContributionOptimizer from '@/components/analytics/ContributionOptimizer';
import TSPvsPrivate from '@/components/analytics/TSPvsPrivate';
import FinancialFitnessScore from '@/components/analytics/FinancialFitnessScore';
import SmartRebalancing from '@/components/analytics/SmartRebalancing';
import PerformanceHistory from '@/components/analytics/PerformanceHistory';
import FundComparisonChart from '@/components/analytics/FundComparisonChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BarChart2, TrendingUp, Target, History } from 'lucide-react';

export default function Analytics() {
  const { activeProfile } = useProfile();

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

  // Was `plan === 'paid'`, which ignored an active trial — this page alone
  // locked out trial users that every other screen let straight in. Declared
  // above the early return: hooks must run in the same order every render.
  const { allowed: canUseAnalytics, loading: planLoading } = useFeature('analytics');

  if (!activeProfile) return <OnboardingPrompt />;
  const selectedFunds = funds.filter(f => f.is_selected);
  const totalBalance = getAccountBalance(activeProfile, funds);

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-6">
      <h2 className="text-lg font-bold mb-4">Analytics</h2>

      {!canUseAnalytics ? (
        <div className="space-y-4">
          <PerformanceHistory profile={activeProfile} dailyBalances={dailyBalances} />
          {!planLoading && <UpgradePrompt feature="analytics" />}
        </div>
      ) : (
        <Tabs defaultValue="optimizer" className="w-full">
          <TabsList className="grid grid-cols-4 w-full mb-4 h-auto">
            <TabsTrigger value="optimizer" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <Target className="w-3.5 h-3.5" />Optimizer
            </TabsTrigger>
            <TabsTrigger value="volatility" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <BarChart2 className="w-3.5 h-3.5" />Risk
            </TabsTrigger>
            <TabsTrigger value="inflation" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <TrendingUp className="w-3.5 h-3.5" />Inflation
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[10px] py-1.5 flex-col gap-0.5 h-auto">
              <History className="w-3.5 h-3.5" />History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="optimizer">
            <div className="space-y-4">
              <ContributionOptimizer profile={activeProfile} totalBalance={totalBalance} />
              <FinancialFitnessScore profile={activeProfile} funds={selectedFunds} totalBalance={totalBalance} />
              <SmartRebalancing profile={activeProfile} funds={selectedFunds} />
              <TSPvsPrivate funds={selectedFunds} />
            </div>
          </TabsContent>
          <TabsContent value="volatility">
            <VolatilityScore funds={selectedFunds} profile={activeProfile} />
          </TabsContent>
          <TabsContent value="inflation">
            <InflationAdjusted profile={activeProfile} totalBalance={totalBalance} />
          </TabsContent>
          <TabsContent value="history">
            <div className="space-y-4">
              <PerformanceHistory profile={activeProfile} dailyBalances={dailyBalances} />
              <FundComparisonChart profile={activeProfile} selectedFunds={selectedFunds} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
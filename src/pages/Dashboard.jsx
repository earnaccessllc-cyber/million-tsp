import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import BalanceHero from '@/components/dashboard/BalanceHero';
import YTDActivity from '@/components/dashboard/YTDActivity';
import MarketMood from '@/components/funds/MarketMood';
import SickLeaveCard from '@/components/dashboard/SickLeaveCard';
import RetirementCountdown from '@/components/retirement/RetirementCountdown';
import { isMarketDay } from '@/lib/marketDays';
import UpgradePrompt from '@/components/common/UpgradePrompt';
import GoalProgressBar from '@/components/dashboard/GoalProgressBar';
import { useFeature } from '@/lib/proGating';
import { getAccountBalance } from '@/lib/accountBalance';
import PullToRefresh from '@/components/common/PullToRefresh';


export default function Dashboard() {
  const { activeProfile, isLoading: profileLoading, refreshProfiles } = useProfile();
  const queryClient = useQueryClient();
  // Free tier is the daily balance itself; everything derived from it is Pro.
  // Hooks must run before the early returns below, so they live up here.
  const { allowed: canSeeGoal } = useFeature('goal_tracking');
  const { allowed: canSeeCountdown } = useFeature('retirement_countdown');
  const { allowed: canSeeInsights, loading: planLoading } = useFeature('dashboard_insights');
  const { allowed: canSeeDailyLog } = useFeature('daily_log');
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

  const handleRefresh = async () => {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['fund-allocations'] }),
      queryClient.invalidateQueries({ queryKey: ['daily-balances'] }),
      refreshProfiles(),
    ]);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If no profile, AppLayout will redirect to /settings — just show nothing here
  if (!activeProfile) return null;

  const selectedFunds = funds.filter(f => f.is_selected);
  const totalBalance = getAccountBalance(activeProfile, funds);
  const sortedBalances = [...dailyBalances]
    .filter(d => d.date && isMarketDay(d.date))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const todayBalance = sortedBalances[0];
  const dailyChange = todayBalance?.daily_change || 0;
  const dailyChangePercent = todayBalance?.daily_change_percent || 0;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="max-w-lg mx-auto">
      {/* Market Mood */}
      <div className="px-4 mt-3">
        <MarketMood />
      </div>

      {/* Goal Progress Bar — Pro */}
      {canSeeGoal && activeProfile.balance_goal > 0 && (
        <div className="px-4 mt-3">
          <GoalProgressBar currentBalance={totalBalance} balanceGoal={activeProfile.balance_goal} profile={activeProfile} />
        </div>
      )}

      {/* Balance Hero — always visible */}
      <BalanceHero
        totalBalance={totalBalance}
        dailyChange={dailyChange}
        dailyChangePercent={dailyChangePercent}
        highestBalance={activeProfile.highest_balance || 0}
        highestBalanceDate={activeProfile.highest_balance_date}
        openingBalance={activeProfile.opening_balance || 0}
        funds={selectedFunds}
        profile={activeProfile}
      />

      {/* Retirement Countdown — Pro */}
      {canSeeCountdown && (
        <div className="mx-4 mt-4">
          <RetirementCountdown profile={activeProfile} compact />
        </div>
      )}

      {/* Pro features */}
      {canSeeInsights ? (
        <>
          <SickLeaveCard profile={activeProfile} tspBalance={totalBalance} />
          <YTDActivity profile={activeProfile} totalBalance={totalBalance} />
        </>
      ) : (
        <div className="mx-4 mt-4">
          {!planLoading && <UpgradePrompt feature="dashboard_insights" />}
        </div>
      )}

      {/* Daily Log Preview — always visible */}
      {canSeeDailyLog && sortedBalances.length > 0 && (
        <div className="mx-4 mt-4 mb-6 p-4 bg-card rounded-xl border border-border">
          <h3 className="text-sm font-semibold mb-3">Recent Daily Changes</h3>
          <div className="space-y-2">
            {sortedBalances.slice(0, 5).map(d => (
              <div key={d.id} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className={`text-xs font-medium ${d.daily_change === 0 ? 'text-muted-foreground' : d.is_gain ? 'text-gain' : 'text-loss'}`}>
                  {d.daily_change >= 0 ? '+' : ''}{(d.daily_change || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
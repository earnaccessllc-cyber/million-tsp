import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useProfile } from '@/context/ProfileContext';
import FundsTabBar from '@/components/funds/FundsTabBar';
import ViewOptions from '@/components/funds/ViewOptions';
import PriceTableView from '@/components/funds/PriceTableView';
import DrumrollCalendar from '@/components/funds/DrumrollCalendar';
import PortfolioHistoryPanel from '@/components/funds/PortfolioHistoryPanel';
import FundHistoryChart from '@/components/funds/FundHistoryChart';
import FundSelector from '@/components/funds/FundSelector';
import FundAllocationEditor from '@/components/funds/FundAllocationEditor';
import OnboardingPrompt from '@/components/onboarding/OnboardingPrompt';
import PullToRefresh from '@/components/common/PullToRefresh';
import { useToast } from '@/components/ui/use-toast';

export default function FundsEnhanced() {
  const { activeProfile, isLoading: profileLoading } = useProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('summary');
  const [activeView, setActiveView] = useState('live');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [priceData, setPriceData] = useState({});
  const [loading, setLoading] = useState(false);
  const [tradingDates, setTradingDates] = useState([]);
  const [nearestDateNote, setNearestDateNote] = useState('');
  const [selectedFund, setSelectedFund] = useState('C');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [myFunds, setMyFunds] = useState([]);
  const [dailyBalances, setDailyBalances] = useState([]);

  // Load fund allocations for the active profile
  useEffect(() => {
    if (!activeProfile) return;
    base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }).then(setMyFunds);
  }, [activeProfile?.id]);

  // Load balance history for the History tab's portfolio chart
  useEffect(() => {
    if (!activeProfile) return;
    base44.entities.DailyBalance.filter({ profile_id: activeProfile.id }, '-date', 365).then(setDailyBalances);
  }, [activeProfile?.id]);

  // Load prices for selected date
  const loadPrices = useCallback(async () => {
    if (!activeProfile) return;
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      if (activeView === 'live') {
        const result = await base44.functions.invoke('fetchLivePrices', {});
        setPriceData(result.funds || result.data?.funds || {});
      } else {
        const result = await base44.functions.invoke('fetchTSPPricesByDate', { date: dateStr });
        const r = result.data || result;
        const data = {};
        const fundNames = ['G', 'F', 'C', 'S', 'I', 'L Income', 'L2030', 'L2035', 'L2040', 'L2045', 'L2050', 'L2055', 'L2060', 'L2065', 'L2070', 'L2075'];
        for (const name of fundNames) {
          if (r.prices?.[name] != null) {
            data[name] = {
              share_price: r.prices[name],
              daily_change: r.changes?.[name] ?? 0,
              daily_change_percent: r.change_pcts?.[name] ?? 0,
            };
          }
        }
        setNearestDateNote(r.date && r.date !== dateStr ? `Showing nearest trading day: ${r.date}` : '');
        setPriceData(data);
      }
    } catch (err) {
      console.error('Error loading prices:', err);
      setPriceData({});
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeView, activeProfile?.id]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const handleRefresh = async () => {
    if (!activeProfile) return;
    const [funds, balances] = await Promise.all([
      base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }),
      base44.entities.DailyBalance.filter({ profile_id: activeProfile.id }, '-date', 365),
    ]);
    setMyFunds(funds);
    setDailyBalances(balances);
    await loadPrices();
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeProfile) return <OnboardingPrompt />;

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
    setActiveView('date');
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    if (view === 'date') {
      setCalendarOpen(true);
    } else {
      setCalendarOpen(false);
    }
    if (view === 'live') {
      setSelectedDate(new Date());
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen bg-background flex flex-col">
      {/* Tab bar */}
      <FundsTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View options */}
          <ViewOptions activeView={activeView} onViewChange={handleViewChange} />

          {/* Main content area */}
          <div className={`flex-1 overflow-y-auto ${calendarOpen ? 'pb-72' : 'pb-8'}`}>
            {activeView === 'chart' ? (
              <div className="px-4 pt-3 space-y-3">
                <FundSelector selected={selectedFund} onSelect={setSelectedFund} />
                <FundHistoryChart
                  fund={{ fund_name: selectedFund, wtd_return_percent: 0, mtd_return_percent: 0, return_percent: 0 }}
                  profile={activeProfile}
                />
              </div>
            ) : activeView === 'fund' ? (
              <div className="px-4 pt-3 space-y-3">
                <FundSelector selected={selectedFund} onSelect={setSelectedFund} />
                <FundHistoryChart
                  fund={{ fund_name: selectedFund, wtd_return_percent: 0, mtd_return_percent: 0, return_percent: 0 }}
                  profile={activeProfile}
                />
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <PriceTableView
                priceData={priceData}
                selectedDate={selectedDate}
                nearestDateNote={nearestDateNote}
                isLive={activeView === 'live'}
                myFunds={myFunds}
                mfwHoldings={activeProfile?.has_mfw ? (activeProfile?.mfw_holdings || []) : []}
              />
            )}
          </div>

          {/* Calendar wheel at bottom — only shown when calendar is open */}
          {calendarOpen && (
            <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background z-20">
              <DrumrollCalendar
                selectedDate={selectedDate}
                onDateChange={handleDateChange}
                onClose={() => setCalendarOpen(false)}
                tradingDates={tradingDates}
              />
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto pb-8">
          <PortfolioHistoryPanel funds={myFunds.filter(f => f.is_selected)} dailyBalances={dailyBalances} profileId={activeProfile.id} />
        </div>
      )}

      {/* Allocations tab */}
      {activeTab === 'allocations' && (
        <div className="flex-1 overflow-y-auto pb-8 px-4 pt-4">
          <FundAllocationEditor
            profileId={activeProfile.id}
            funds={myFunds}
            onSaved={() => base44.entities.FundAllocation.filter({ profile_id: activeProfile.id }).then(setMyFunds)}
          />
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
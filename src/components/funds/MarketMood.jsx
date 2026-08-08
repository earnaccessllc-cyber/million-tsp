import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fetchLivePricesSheet } from '@/functions/fetchLivePricesSheet';
import { useQuery } from '@tanstack/react-query';

function getMood(funds) {
  const valid = funds.filter(f => f.day_percent !== null);
  if (!valid.length) return null;

  const upCount = valid.filter(f => f.day_percent > 0).length;
  const downCount = valid.filter(f => f.day_percent < 0).length;
  const total = valid.length;
  const avgDay = valid.reduce((s, f) => s + f.day_percent, 0) / total;

  let mood, label, color, emoji, bgColor;
  if (upCount / total >= 0.75) {
    mood = 'bull'; label = 'Bull Day'; color = 'text-gain'; emoji = '🐂';
    bgColor = 'bg-gain/10 border-gain/20';
  } else if (downCount / total >= 0.75) {
    mood = 'bear'; label = 'Bear Day'; color = 'text-loss'; emoji = '🐻';
    bgColor = 'bg-loss/10 border-loss/20';
  } else {
    mood = 'neutral'; label = 'Mixed Day'; color = 'text-yellow-400'; emoji = '⚖️';
    bgColor = 'bg-muted border-border';
  }

  const bestDay = [...valid].sort((a, b) => b.day_percent - a.day_percent)[0];
  const bestYTD = [...valid].sort((a, b) => b.year_percent - a.year_percent)[0];
  const sorted = [...valid].sort((a, b) => b.day_percent - a.day_percent);

  return { mood, label, color, emoji, bgColor, avgDay, upCount, downCount, bestDay, bestYTD, sorted };
}

export default function MarketMood() {
  const [showMovers, setShowMovers] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['live-prices-sheet'],
    queryFn: async () => {
      const res = await fetchLivePricesSheet({});
      return res.data?.funds || [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mb-4 p-3 rounded-xl border border-border bg-muted flex items-center gap-2">
        <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-muted-foreground">Loading market data...</span>
      </div>
    );
  }

  if (isError || !data) return null;

  const mood = getMood(data);
  if (!mood) return null;

  return (
    <div className="mb-4">
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-3 rounded-xl border ${mood.bgColor}`}
      >
        {/* Main mood row */}
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{mood.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-bold ${mood.color}`}>{mood.label}</span>
              <span className={`text-xs font-semibold ${mood.color}`}>
                {mood.avgDay >= 0 ? '+' : ''}{mood.avgDay.toFixed(2)}% today
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mood.upCount} up, {mood.downCount} down today. Best: {mood.bestDay.fund_name} {mood.bestDay.day_percent >= 0 ? '+' : ''}{mood.bestDay.day_percent.toFixed(2)}%
            </p>
            {mood.bestYTD && (
              <p className="text-xs text-muted-foreground">
                Best YTD: <span className="text-gain font-medium">{mood.bestYTD.fund_name} +{mood.bestYTD.year_percent.toFixed(2)}%</span>
              </p>
            )}
          </div>
          {/* Toggle movers */}
          <button
            onClick={() => setShowMovers(v => !v)}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            {showMovers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Fund Movers expandable */}
        <AnimatePresence>
          {showMovers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/40">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Today's Fund Movers</p>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {mood.sorted.map((f, i) => (
                    <div key={f.fund_name} className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-xs font-medium text-foreground">{f.fund_name}</span>
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${f.day_percent > 0 ? 'text-gain' : f.day_percent < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
                        {f.day_percent > 0 ? '+' : ''}{f.day_percent.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
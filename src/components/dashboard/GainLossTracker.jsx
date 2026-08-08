import React from 'react';
import { formatCurrency, formatPercent } from '@/lib/tspFunds';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { isMarketDay } from '@/lib/marketDays';

export default function GainLossTracker({ dailyBalances }) {
  const year2026 = (dailyBalances || []).filter(d => d.date && d.date.startsWith('2026') && isMarketDay(d.date));
  
  const gainDays = year2026.filter(d => d.is_gain === true);
  const lossDays = year2026.filter(d => d.is_gain === false);
  const totalDays = year2026.length;
  const tradingDaysInYear = 252;

  const bestDay = gainDays.length > 0 
    ? gainDays.reduce((best, d) => (d.daily_change || 0) > (best.daily_change || 0) ? d : best, gainDays[0])
    : null;
  
  const worstDay = lossDays.length > 0
    ? lossDays.reduce((worst, d) => (d.daily_change || 0) < (worst.daily_change || 0) ? d : worst, lossDays[0])
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mx-4 mt-4 grid grid-cols-2 gap-3"
    >
      {/* Gain Days */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-gain" />
          <span className="text-xs font-semibold text-gain">Gain Days</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{gainDays.length}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {totalDays > 0 ? ((gainDays.length / tradingDaysInYear) * 100).toFixed(1) : '0'}% of trading days
        </p>
        {bestDay && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Best day</p>
            <p className="text-xs font-medium text-gain">
              {formatCurrency(bestDay.daily_change)}
            </p>
          </div>
        )}
      </div>

      {/* Loss Days */}
      <div className="p-4 bg-card rounded-xl border border-border">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-loss" />
          <span className="text-xs font-semibold text-loss">Loss Days</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{lossDays.length}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {totalDays > 0 ? ((lossDays.length / tradingDaysInYear) * 100).toFixed(1) : '0'}% of trading days
        </p>
        {worstDay && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">Worst day</p>
            <p className="text-xs font-medium text-loss">
              {formatCurrency(worstDay.daily_change)}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
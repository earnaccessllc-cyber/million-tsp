import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function getDaysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

export default function DrumrollCalendar({ selectedDate, onDateChange, onClose }) {
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [day, setDay] = useState(selectedDate.getDate());
  const [year, setYear] = useState(Math.max(selectedDate.getFullYear(), new Date().getFullYear() - 1));
  const [showMessage, setShowMessage] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const today = new Date();
  const currentYear = today.getFullYear();
  const minDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const years = Array.from({ length: 2 }, (_, i) => currentYear - 1 + i);
  const daysInMonth = getDaysInMonth(month, year);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Determine valid month/day bounds for the selected year
  const minMonth = year === minDate.getFullYear() ? minDate.getMonth() : 0;
  const maxMonth = year === currentYear ? today.getMonth() : 11;
  const minDay = year === minDate.getFullYear() && month === minDate.getMonth() ? minDate.getDate() : 1;
  const maxDay = year === currentYear && month === today.getMonth() ? today.getDate() : daysInMonth;

  const handleConfirm = async () => {
    setIsFetching(true);
    setShowMessage('');
    const targetDate = new Date(year, month, day);
    const dateStr = targetDate.toISOString().split('T')[0];

    try {
      const raw = await base44.functions.invoke('fetchTSPPricesByDate', { date: dateStr });
      const result = raw.data || raw;

      if (result && result.success) {
        const resolvedDate = result.date !== dateStr ? result.date : dateStr;
        onDateChange(new Date(resolvedDate + 'T12:00:00'));
        if (onClose) onClose();
      } else {
        const msg = result?.error || 'No data available for this date — try a later date';
        setShowMessage(msg);
        setTimeout(() => setShowMessage(''), 4000);
      }
    } catch (err) {
      // Handle 404 (date before data range) and other errors gracefully
      const serverMsg = err?.response?.data?.error;
      if (serverMsg && serverMsg.includes('No data found')) {
        setShowMessage('No data before this date — try a later date');
      } else {
        setShowMessage('Error loading prices — try again');
      }
      setTimeout(() => setShowMessage(''), 4000);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-card border-t border-border p-4 space-y-3" style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground uppercase">Select Date</div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showMessage && (
        <div className="text-center text-xs text-amber-500 bg-amber-500/10 rounded px-3 py-2">
          {showMessage}
        </div>
      )}

      {/* Three column scrollers */}
      <div className="flex items-center justify-center gap-3 h-40">
        {/* Month */}
        <div className="relative flex-1 max-w-[80px]">
          <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
          <div className="overflow-y-scroll h-40 scrollbar-hide">
            <div className="h-14" />
            {months.map((m, idx) => {
              const disabled = idx < minMonth || idx > maxMonth;
              return (
                <div
                  key={m}
                  onClick={() => {
                    if (disabled) return;
                    setMonth(idx);
                    // clamp day if needed
                    const newMax = year === currentYear && idx === today.getMonth() ? today.getDate() : getDaysInMonth(idx, year);
                    const newMin = year === minDate.getFullYear() && idx === minDate.getMonth() ? minDate.getDate() : 1;
                    setDay(d => Math.min(Math.max(d, newMin), newMax));
                  }}
                  className={`h-12 flex items-center justify-center text-sm font-medium transition-opacity ${
                    disabled ? 'opacity-20 cursor-not-allowed' : idx === month ? 'text-foreground opacity-100 cursor-pointer' : 'text-muted-foreground opacity-50 cursor-pointer'
                  }`}
                >
                  {m}
                </div>
              );
            })}
            <div className="h-14" />
          </div>
        </div>

        {/* Day */}
        <div className="relative flex-1 max-w-[80px]">
          <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
          <div className="overflow-y-scroll h-40 scrollbar-hide">
            <div className="h-14" />
            {days.map((d) => {
              const disabled = d < minDay || d > maxDay;
              return (
                <div
                  key={d}
                  onClick={() => { if (!disabled) setDay(d); }}
                  className={`h-12 flex items-center justify-center text-sm font-medium transition-opacity ${
                    disabled ? 'opacity-20 cursor-not-allowed' : d === day ? 'text-foreground opacity-100 cursor-pointer' : 'text-muted-foreground opacity-50 cursor-pointer'
                  }`}
                >
                  {String(d).padStart(2, '0')}
                </div>
              );
            })}
            <div className="h-14" />
          </div>
        </div>

        {/* Year */}
        <div className="relative flex-1 max-w-[80px]">
          <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
          <div className="overflow-y-scroll h-40 scrollbar-hide">
            <div className="h-14" />
            {years.map((y) => (
              <div
                key={y}
                onClick={() => {
                  setYear(y);
                  // clamp month and day to valid range for new year
                  const newMinMonth = y === minDate.getFullYear() ? minDate.getMonth() : 0;
                  const newMaxMonth = y === currentYear ? today.getMonth() : 11;
                  const clampedMonth = Math.min(Math.max(month, newMinMonth), newMaxMonth);
                  setMonth(clampedMonth);
                  const newMinDay = y === minDate.getFullYear() && clampedMonth === minDate.getMonth() ? minDate.getDate() : 1;
                  const newMaxDay = y === currentYear && clampedMonth === today.getMonth() ? today.getDate() : getDaysInMonth(clampedMonth, y);
                  setDay(d => Math.min(Math.max(d, newMinDay), newMaxDay));
                }}
                className={`h-12 flex items-center justify-center text-sm font-medium cursor-pointer transition-opacity ${
                  y === year ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-50'
                }`}
              >
                {y}
              </div>
            ))}
            <div className="h-14" />
          </div>
        </div>
      </div>

      <Button
        onClick={handleConfirm}
        disabled={isFetching}
        className="w-full"
        style={{ minHeight: 52, fontSize: 15, fontWeight: 700, background: '#C9A832', color: '#000' }}
      >
        {isFetching ? 'Loading prices…' : 'SELECT DATE'}
      </Button>
    </div>
  );
}
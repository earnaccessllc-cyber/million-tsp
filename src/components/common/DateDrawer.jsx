import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

/**
 * A mobile-friendly date picker using a Drawer bottom sheet.
 * Works as a drop-in replacement for <input type="date">.
 *
 * Props:
 *   value: string (YYYY-MM-DD)
 *   onChange: (value: string) => void
 *   label?: string
 *   min?: string (YYYY-MM-DD)
 *   max?: string (YYYY-MM-DD)
 *   className?: string
 */
export default function DateDrawer({ value, onChange, min, max, className = '' }) {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const parsed = value ? new Date(value + 'T12:00:00') : today;

  const [month, setMonth] = useState(parsed.getMonth());
  const [day, setDay] = useState(parsed.getDate());
  const [year, setYear] = useState(parsed.getFullYear());

  const minDate = min ? new Date(min + 'T00:00:00') : new Date(today.getFullYear() - 80, 0, 1);
  const maxDate = max ? new Date(max + 'T00:00:00') : new Date(today.getFullYear() + 50, 11, 31);

  const minYear = minDate.getFullYear();
  const maxYear = maxDate.getFullYear();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function daysInMonth(m, y) {
    return new Date(y, m + 1, 0).getDate();
  }

  const days = Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1);

  const minMonth = year === minYear ? minDate.getMonth() : 0;
  const maxMonth = year === maxYear ? maxDate.getMonth() : 11;
  const minDay = year === minYear && month === minDate.getMonth() ? minDate.getDate() : 1;
  const maxDay = year === maxYear && month === maxDate.getMonth() ? maxDate.getDate() : daysInMonth(month, year);

  const handleOpen = () => {
    // Sync state with current value when opening
    const d = value ? new Date(value + 'T12:00:00') : today;
    setMonth(d.getMonth());
    setDay(d.getDate());
    setYear(d.getFullYear());
    setOpen(true);
  };

  const handleConfirm = () => {
    const clampedDay = Math.min(Math.max(day, minDay), maxDay);
    const d = new Date(year, month, clampedDay);
    onChange(d.toISOString().split('T')[0]);
    setOpen(false);
  };

  const displayValue = value
    ? new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between h-9 px-3 rounded-md border border-input bg-transparent text-sm select-none ${className}`}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{displayValue}</span>
        <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Select Date</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-2 space-y-3">
            {/* Three column drum-roll scrollers */}
            <div className="flex items-center justify-center gap-3 h-44">
              {/* Month */}
              <div className="relative flex-1">
                <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
                <div className="overflow-y-auto h-44">
                  <div className="h-16" />
                  {months.map((m, idx) => {
                    const disabled = idx < minMonth || idx > maxMonth;
                    return (
                      <div
                        key={m}
                        onClick={() => {
                          if (disabled) return;
                          setMonth(idx);
                          const newMax = year === maxYear && idx === maxDate.getMonth() ? maxDate.getDate() : daysInMonth(idx, year);
                          const newMin = year === minYear && idx === minDate.getMonth() ? minDate.getDate() : 1;
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
                  <div className="h-16" />
                </div>
              </div>

              {/* Day */}
              <div className="relative w-16">
                <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
                <div className="overflow-y-auto h-44">
                  <div className="h-16" />
                  {days.map(d => {
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
                  <div className="h-16" />
                </div>
              </div>

              {/* Year */}
              <div className="relative flex-1">
                <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-12 rounded-lg border-2 border-primary/30 bg-primary/5 pointer-events-none z-10" />
                <div className="overflow-y-auto h-44">
                  <div className="h-16" />
                  {years.map(y => (
                    <div
                      key={y}
                      onClick={() => {
                        setYear(y);
                        const newMinMonth = y === minYear ? minDate.getMonth() : 0;
                        const newMaxMonth = y === maxYear ? maxDate.getMonth() : 11;
                        const cm = Math.min(Math.max(month, newMinMonth), newMaxMonth);
                        setMonth(cm);
                        const newMinDay = y === minYear && cm === minDate.getMonth() ? minDate.getDate() : 1;
                        const newMaxDay = y === maxYear && cm === maxDate.getMonth() ? maxDate.getDate() : daysInMonth(cm, y);
                        setDay(d => Math.min(Math.max(d, newMinDay), newMaxDay));
                      }}
                      className={`h-12 flex items-center justify-center text-sm font-medium cursor-pointer transition-opacity ${
                        y === year ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-50'
                      }`}
                    >
                      {y}
                    </div>
                  ))}
                  <div className="h-16" />
                </div>
              </div>
            </div>

            <Button onClick={handleConfirm} className="w-full mb-2">Confirm</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
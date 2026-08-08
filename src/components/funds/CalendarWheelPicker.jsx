import React, { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CalendarWheelPicker({ onDateChange, validDates = [] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const monthRef = useRef(null);
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  const month = selectedDate.getMonth();
  const day = selectedDate.getDate();
  const year = selectedDate.getFullYear();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const years = Array.from({ length: 30 }, (_, i) => year - 15 + i);

  const handleMonthChange = (offset) => {
    const newDate = new Date(year, month + offset, 1);
    setSelectedDate(newDate);
  };

  const handleDayChange = (offset) => {
    const newDate = new Date(year, month, day + offset);
    setSelectedDate(newDate);
  };

  const handleYearChange = (offset) => {
    const newDate = new Date(year + offset, month, day);
    setSelectedDate(newDate);
  };

  useEffect(() => {
    onDateChange(selectedDate.toISOString().split('T')[0]);
  }, [selectedDate]);

  return (
    <div className="flex justify-center gap-8 py-6 bg-secondary/20 rounded-lg">
      {/* Month Wheel */}
      <div className="flex flex-col items-center gap-2">
        <button onClick={() => handleMonthChange(-1)} className="p-1">
          <ChevronUp className="w-4 h-4" />
        </button>
        <div ref={monthRef} className="text-lg font-bold w-16 text-center h-8 flex items-center justify-center">
          {MONTHS[month]}
        </div>
        <button onClick={() => handleMonthChange(1)} className="p-1">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Day Wheel */}
      <div className="flex flex-col items-center gap-2">
        <button onClick={() => handleDayChange(-1)} className="p-1">
          <ChevronUp className="w-4 h-4" />
        </button>
        <div ref={dayRef} className="text-lg font-bold w-12 text-center h-8 flex items-center justify-center">
          {String(day).padStart(2, '0')}
        </div>
        <button onClick={() => handleDayChange(1)} className="p-1">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Year Wheel */}
      <div className="flex flex-col items-center gap-2">
        <button onClick={() => handleYearChange(-1)} className="p-1">
          <ChevronUp className="w-4 h-4" />
        </button>
        <div ref={yearRef} className="text-lg font-bold w-16 text-center h-8 flex items-center justify-center">
          {year}
        </div>
        <button onClick={() => handleYearChange(1)} className="p-1">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
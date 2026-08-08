import React, { useState } from 'react';
import FundSelector from '@/components/funds/FundSelector';
import CalendarWheelPicker from '@/components/funds/CalendarWheelPicker';
import PriceDisplay from '@/components/funds/PriceDisplay';

export default function FundPriceLookup() {
  const [selectedFund, setSelectedFund] = useState('C');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="space-y-4 px-4 pt-4">
        {/* Fund selector */}
        <FundSelector selected={selectedFund} onSelect={setSelectedFund} />

        {/* Calendar wheel picker */}
        <div className="bg-card rounded-lg border border-border">
          <CalendarWheelPicker onDateChange={setSelectedDate} />
        </div>

        {/* Price display */}
        <PriceDisplay selectedDate={selectedDate} selectedFund={selectedFund} />
      </div>
    </div>
  );
}
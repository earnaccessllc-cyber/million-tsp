import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

const JAN1_2026_PRICES = {
  'G': 19.5922, 'F': 20.8602, 'C': 109.7449, 'S': 101.6677, 'I': 56.0292,
  'L Income': 29.2952, 'L2030': 58.3022, 'L2035': 17.7506, 'L2040': 68.0819,
  'L2045': 18.8435, 'L2050': 41.7575, 'L2055': 21.5591, 'L2060': 21.5566,
  'L2065': 21.5541, 'L2070': 12.7748, 'L2075': 11.1588,
};

export default function PriceDisplay({ selectedDate, selectedFund }) {
  const [price, setPrice] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedDate || selectedFund === 'All') {
      setPrice(null);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const data = await base44.entities.TSPHistoricalPrice.filter({
          date: selectedDate,
          fund_name: selectedFund,
        });

        if (data.length > 0) {
          setPrice(data[0].share_price);
        } else {
          setPrice(null);
        }

        // Get previous trading day
        const dateObj = new Date(selectedDate);
        const prevDate = new Date(dateObj.getTime() - 86400000);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        const prevData = await base44.entities.TSPHistoricalPrice.filter({
          date: prevDateStr,
          fund_name: selectedFund,
        });
        setPrevPrice(prevData.length > 0 ? prevData[0].share_price : null);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, [selectedDate, selectedFund]);

  if (selectedFund === 'All' || !price) {
    return <div className="text-center text-sm text-muted-foreground py-4">Select a fund and date</div>;
  }

  const dailyChange = prevPrice ? price - prevPrice : 0;
  const dailyPct = prevPrice ? (dailyChange / prevPrice) * 100 : 0;
  const jan1Price = JAN1_2026_PRICES[selectedFund];
  const ytdChange = jan1Price ? price - jan1Price : 0;
  const ytdPct = jan1Price ? (ytdChange / jan1Price) * 100 : 0;

  const renderChange = (change, pct) => {
    const isGain = change >= 0;
    return (
      <div className={`text-sm font-semibold ${isGain ? 'text-gain' : 'text-destructive'}`}>
        {isGain ? '+' : ''}{change.toFixed(4)} ({isGain ? '+' : ''}{pct.toFixed(2)}%)
      </div>
    );
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="text-center">
        <div className="text-3xl font-bold text-primary">${price.toFixed(4)}</div>
        <div className="text-xs text-muted-foreground">{selectedFund} on {selectedDate}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Daily Change</div>
          {renderChange(dailyChange, dailyPct)}
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">YTD Change</div>
          {renderChange(ytdChange, ytdPct)}
        </div>
      </div>
    </Card>
  );
}
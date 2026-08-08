import React from 'react';
import { Button } from '@/components/ui/button';
import { Radio, Calendar, BarChart3, Eye } from 'lucide-react';

export default function ViewOptions({ activeView, onViewChange }) {
  const options = [
    { id: 'live', label: 'Live', icon: Radio },
    { id: 'date', label: 'Date', icon: Calendar },
  ];

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-secondary/20 border-b border-border">
      {options.map(opt => {
        const Icon = opt.icon;
        const isActive = activeView === opt.id;
        return (
          <Button
            key={opt.id}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(opt.id)}
            className="flex-1 gap-2"
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">{opt.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
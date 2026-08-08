import React from 'react';
import { Button } from '@/components/ui/button';

const FUNDS = ['G', 'F', 'C', 'S', 'I', 'L Income', 'L2030', 'L2035', 'L2040', 'L2045', 'L2050', 'L2055', 'L2060', 'L2065', 'L2070', 'L2075', 'All'];

export default function FundSelector({ selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4">
      {FUNDS.map(fund => (
        <Button
          key={fund}
          variant={selected === fund ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(fund)}
          className={selected === fund ? 'bg-primary text-primary-foreground' : ''}
        >
          {fund}
        </Button>
      ))}
    </div>
  );
}
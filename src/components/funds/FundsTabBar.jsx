import React from 'react';
import { Button } from '@/components/ui/button';

export default function FundsTabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-0 border-b border-border">
      <Button
        variant={activeTab === 'summary' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onTabChange('summary')}
        className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
        data-active={activeTab === 'summary'}
      >
        Summary
      </Button>
      <Button
        variant={activeTab === 'history' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onTabChange('history')}
        className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
        data-active={activeTab === 'history'}
      >
        History
      </Button>
      <Button
        variant={activeTab === 'allocations' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onTabChange('allocations')}
        className="rounded-none border-b-2 border-transparent data-[active=true]:border-primary"
        data-active={activeTab === 'allocations'}
      >
        Allocations
      </Button>
    </div>
  );
}
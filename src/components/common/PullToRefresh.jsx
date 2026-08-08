import React, { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (containerRef.current?.scrollTop !== 0) return;
    // Don't initiate a pull if the touch began inside an inner scrollable
    // that isn't at its own top — let that element scroll normally instead.
    let el = e.touches[0]?.target;
    while (el && el !== containerRef.current) {
      if (el.scrollHeight > el.clientHeight && el.scrollTop > 0) return;
      el = el.parentElement;
    }
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault();
      setPullDistance(Math.min(delta * 0.5, PULL_THRESHOLD + 20));
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPullDistance(0);
    startY.current = null;
  }, [pullDistance, refreshing, onRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const isReady = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-150"
        style={{ height: refreshing ? PULL_THRESHOLD : pullDistance }}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isReady || refreshing ? 'border-primary bg-primary/10' : 'border-muted-foreground/40'}`}
          style={{ transform: `rotate(${progress * 360}deg)` }}
        >
          <RefreshCw
            className={`w-4 h-4 ${isReady || refreshing ? 'text-primary' : 'text-muted-foreground/40'} ${refreshing ? 'animate-spin' : ''}`}
          />
        </div>
      </div>

      {children}
    </div>
  );
}
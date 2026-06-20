import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefreshIndicator({ pullDistance, refreshing, threshold }) {
  const progress = Math.min(pullDistance / threshold, 1);
  const ready = pullDistance >= threshold;

  if (!refreshing && pullDistance <= 0) return null;

  return (
    <div
      className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none transition-all duration-150"
      style={{ transform: `translateY(${Math.min(pullDistance - 40, 24)}px)`, opacity: progress }}
    >
      <div className="bg-card border border-border rounded-full p-2 shadow-md">
        <RefreshCw
          className={`w-5 h-5 text-primary transition-all ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: `rotate(${progress * 360}deg)` }}
        />
      </div>
    </div>
  );
}
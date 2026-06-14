import React from 'react';
import { Card } from '@/components/ui/card';
import { calculateHealthScore, getHealthLabel } from '@/lib/constants';

export default function HealthScore({ monthlyIncomes, expenses }) {
  const score = calculateHealthScore(monthlyIncomes, expenses);
  const { label, color } = getHealthLabel(score);
  
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card className="p-5 border-0 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Financial Health</h3>
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-bold">{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase">Score</span>
          </div>
        </div>
        <p className={`mt-3 text-sm font-semibold ${color}`}>{label}</p>
        <p className="text-xs text-muted-foreground mt-1">Based on savings, investments & discipline</p>
      </div>
    </Card>
  );
}
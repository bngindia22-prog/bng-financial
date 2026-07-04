import React from 'react';
import { Card } from '@/components/ui/card';
import { calculateHealthScore, getHealthLabel } from '@/lib/constants';

export default function HealthScore({ monthlyIncomes, expenses }) {
  const score = calculateHealthScore(monthlyIncomes, expenses);
  const { label, color } = getHealthLabel(score);

  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  const gradientId = `health-grad-${score}`;

  return (
    <Card className="p-5 border-0 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-blue-500" />
        <h3 className="text-sm font-semibold text-foreground">Financial Health</h3>
      </div>
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000"
              style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-display font-bold text-foreground">{score}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</span>
          </div>
        </div>
        <div className="mt-3 px-3 py-1 rounded-full" style={{ backgroundColor: `${strokeColor}15` }}>
          <p className={`text-sm font-semibold ${color}`}>{label}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center px-2">Based on savings, investments & discipline</p>
      </div>
    </Card>
  );
}
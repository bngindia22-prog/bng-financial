import React from 'react';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/constants';

export default function MonthSummary({ monthLabel, income, spent }) {
  const remaining = Math.max(income - spent, 0);
  const pct = income > 0 ? Math.min(Math.round((spent / income) * 100), 100) : 0;

  return (
    <Card className="p-6 border-0 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{monthLabel} · మిగిలిన డబ్బు</p>
      <p className="text-3xl lg:text-4xl font-display font-semibold text-foreground mt-2">{formatCurrency(remaining)}</p>
      <p className="text-sm text-muted-foreground mt-1">Remaining this month</p>

      <div className="mt-5 h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">ఆదాయం · Income</p>
          <p className="text-base font-semibold text-foreground mt-0.5">{formatCurrency(income)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">ఖర్చు · Spent</p>
          <p className="text-base font-semibold text-foreground mt-0.5">{formatCurrency(spent)}</p>
        </div>
      </div>
    </Card>
  );
}
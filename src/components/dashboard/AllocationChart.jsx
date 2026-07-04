import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { CATEGORIES, formatCurrency } from '@/lib/constants';

export default function AllocationChart({ monthlyIncome }) {
  if (!monthlyIncome) {
    return (
      <Card className="p-5 border-0 shadow-sm h-full flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-secondary mx-auto mb-3 flex items-center justify-center">
            <span className="text-lg font-bold text-muted-foreground">6</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">No income added for this month yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add income to see your allocation</p>
        </div>
      </Card>
    );
  }

  const data = CATEGORIES.map(cat => ({
    name: cat.label,
    value: monthlyIncome[cat.key] || 0,
    color: cat.color,
    percentage: cat.percentage,
  })).filter(d => d.value > 0);

  return (
    <Card className="p-5 border-0 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-5 rounded-full bg-emerald-500" />
        <h3 className="text-sm font-semibold text-foreground">Monthly Allocation</h3>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-44 h-44 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val) => formatCurrency(val)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-display font-bold text-foreground">{formatCurrency(monthlyIncome.income)}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
          </div>
        </div>
        <div className="flex-1 space-y-2 w-full">
          {CATEGORIES.map(cat => {
            const val = monthlyIncome[cat.key] || 0;
            const pct = monthlyIncome.income > 0 ? (val / monthlyIncome.income) * 100 : 0;
            return (
              <div key={cat.key} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-secondary/40 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm flex-1 truncate">{cat.label}</span>
                <span className="text-sm font-semibold">{formatCurrency(val)}</span>
                <span className="text-xs text-muted-foreground w-10 text-right font-medium">{cat.percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
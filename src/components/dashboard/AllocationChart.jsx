import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { CATEGORIES, formatCurrency } from '@/lib/constants';

export default function AllocationChart({ monthlyIncome }) {
  if (!monthlyIncome) return null;

  const data = CATEGORIES.map(cat => ({
    name: cat.label,
    value: monthlyIncome[cat.key] || 0,
    color: cat.color,
    percentage: cat.percentage,
  })).filter(d => d.value > 0);

  return (
    <Card className="p-5 border-0 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Monthly Allocation</h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
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
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2.5 w-full">
          {CATEGORIES.map(cat => {
            const val = monthlyIncome[cat.key] || 0;
            const pct = monthlyIncome.income > 0 ? (val / monthlyIncome.income) * 100 : 0;
            return (
              <div key={cat.key} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-sm flex-1 truncate">{cat.label}</span>
                <span className="text-sm font-semibold">{formatCurrency(val)}</span>
                <span className="text-xs text-muted-foreground w-10 text-right">{cat.percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
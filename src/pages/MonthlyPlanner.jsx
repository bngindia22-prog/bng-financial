import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTH_SHORT, CATEGORIES, allocateIncome, formatCurrency } from '@/lib/constants';
import { motion } from 'framer-motion';
import { Edit3, Check, X } from 'lucide-react';

export default function MonthlyPlanner() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [editingMonth, setEditingMonth] = useState(null);
  const [editValue, setEditValue] = useState('');
  const queryClient = useQueryClient();

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes'],
    queryFn: () => base44.entities.MonthlyIncome.list('-created_date', 200),
  });

  const createIncome = useMutation({
    mutationFn: (data) => base44.entities.MonthlyIncome.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incomes'] }),
  });

  const updateIncome = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MonthlyIncome.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incomes'] }),
  });

  const yearIncomes = incomes.filter(i => i.year === Number(year));
  const monthData = MONTH_SHORT.map((label, idx) => {
    const monthNum = idx + 1;
    const existing = yearIncomes.find(i => i.month === monthNum);
    return { label, month: monthNum, data: existing };
  });

  const totals = CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = yearIncomes.reduce((s, i) => s + (i[cat.key] || 0), 0);
    return acc;
  }, {});
  const totalIncome = yearIncomes.reduce((s, i) => s + (i.income || 0), 0);

  const handleSave = (monthNum) => {
    const val = Number(editValue);
    if (!val || val <= 0) return;
    const allocation = allocateIncome(val);
    const existing = yearIncomes.find(i => i.month === monthNum);
    
    if (existing) {
      updateIncome.mutate({ id: existing.id, data: { income: val, ...allocation } });
    } else {
      createIncome.mutate({ year: Number(year), month: monthNum, income: val, ...allocation });
    }
    setEditingMonth(null);
    setEditValue('');
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Monthly Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">Six-Point Financial Allocation</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-primary/5 px-4 py-3 border-b">
          <h3 className="font-display font-bold text-sm uppercase tracking-wider text-center">
            Monthly Expenditure From Six Points — {year}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50">
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[60px]">{year}</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider min-w-[100px]">Income</th>
                {CATEGORIES.map(cat => (
                  <th key={cat.key} className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider min-w-[100px]" style={{ color: cat.color }}>
                    {cat.label}<br /><span className="opacity-60">({cat.percentage}%)</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthData.map((row, idx) => (
                <tr key={row.month} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${idx % 2 === 0 ? 'bg-card' : 'bg-secondary/10'}`}>
                  <td className="px-3 py-3 font-semibold text-xs uppercase tracking-wider">{row.label}</td>
                  <td className="px-3 py-3 text-right">
                    {editingMonth === row.month ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          type="number"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-24 h-7 text-xs text-right"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleSave(row.month)}
                        />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSave(row.month)}>
                          <Check className="w-3 h-3 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMonth(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 text-right font-medium hover:text-primary transition-colors group"
                        onClick={() => { setEditingMonth(row.month); setEditValue(row.data?.income || ''); }}
                      >
                        {row.data ? formatCurrency(row.data.income) : '₹0'}
                        <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </td>
                  {CATEGORIES.map(cat => (
                    <td key={cat.key} className="px-3 py-3 text-right font-medium tabular-nums">
                      {row.data ? formatCurrency(row.data[cat.key]) : '₹0'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/5 font-bold">
                <td className="px-3 py-3 text-xs uppercase tracking-wider">Total</td>
                <td className="px-3 py-3 text-right text-primary">{formatCurrency(totalIncome)}</td>
                {CATEGORIES.map(cat => (
                  <td key={cat.key} className="px-3 py-3 text-right" style={{ color: cat.color }}>
                    {formatCurrency(totals[cat.key])}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MONTHS, allocateIncome, formatCurrency, CATEGORIES } from '@/lib/constants';
import { IndianRupee } from 'lucide-react';

export default function IncomeModal({ open, onOpenChange, onSubmit, currentMonth, currentYear, editRecord }) {
  const [income, setIncome] = useState('');
  const allocation = allocateIncome(Number(income) || 0);

  useEffect(() => {
    if (open) {
      setIncome(editRecord ? String(editRecord.income) : '');
    }
  }, [open, editRecord]);

  const handleSubmit = () => {
    if (!income || Number(income) <= 0) return;
    onSubmit({
      year: currentYear,
      month: currentMonth,
      income: Number(income),
      ...allocation,
    });
    setIncome('');
    onOpenChange(false);
  };

  const isEdit = !!editRecord;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? 'Edit' : 'Enter'} Income — {MONTHS[currentMonth - 1]} {currentYear}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="income" className="text-sm text-muted-foreground">Monthly Income (₹)</Label>
            <div className="relative mt-1.5">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="income"
                type="number"
                placeholder="e.g. 50000"
                value={income}
                onChange={e => setIncome(e.target.value)}
                className="pl-9 text-lg font-semibold"
              />
            </div>
          </div>

          {Number(income) > 0 && (
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Auto Allocation Preview</p>
              {CATEGORIES.map(cat => (
                <div key={cat.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm">{cat.label} ({cat.percentage}%)</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(allocation[cat.key])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!income || Number(income) <= 0}>
            {isEdit ? 'Update Income' : 'Save Income'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MobileSelect } from '@/components/ui/MobileSelect';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import { CATEGORIES, formatCurrency, getCategoryLabel, getCategoryColor, MONTHS } from '@/lib/constants';
import { Plus, Trash2, Wallet, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';

export default function Expenses() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], category: '', amount: '', notes: '' });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const now = new Date();

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ created_by_id: user.id }, '-date', 200),
    enabled: !!user,
  });

  const { data: incomes = [], refetch: refetchIncomes } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => base44.entities.MonthlyIncome.filter({ created_by_id: user.id }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: categoryLinks = [] } = useQuery({
    queryKey: ['categoryLinks'],
    queryFn: () => base44.entities.CategoryLink.list(),
  });

  // 9. Pull-to-refresh
  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh(
    async () => { await Promise.all([refetchExpenses(), refetchIncomes()]); }
  );

  // 5. Optimistic create
  const createExpense = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', user?.id] });
      const prev = queryClient.getQueryData(['expenses', user?.id]);
      queryClient.setQueryData(['expenses', user?.id], old => [{ ...newItem, id: 'optimistic-' + Date.now() }, ...(old || [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['expenses', user?.id], ctx.prev),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.id] });
    },
  });

  // 5. Optimistic delete
  const deleteExpense = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', user?.id] });
      const prev = queryClient.getQueryData(['expenses', user?.id]);
      queryClient.setQueryData(['expenses', user?.id], old => (old || []).filter(e => e.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['expenses', user?.id], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['expenses', user?.id] }),
  });

  const resetForm = () => setForm({ date: new Date().toISOString().split('T')[0], category: '', amount: '', notes: '' });

  const handleSubmit = () => {
    if (!form.category || !form.amount || Number(form.amount) <= 0) return;
    const d = new Date(form.date);
    createExpense.mutate(
      {
        ...form,
        amount: Number(form.amount),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      },
      {
        onSuccess: () => {
          setShowForm(false);
          resetForm();
        },
      }
    );
  };

  // Budget overview for current month
  const currentMonthIncome = incomes.find(i => i.month === now.getMonth() + 1 && i.year === now.getFullYear());
  const currentMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() + 1 === now.getMonth() + 1 && d.getFullYear() === now.getFullYear();
  });

  const budgetByCategory = CATEGORIES.map(cat => {
    const budget = currentMonthIncome?.[cat.key] || 0;
    const spent = currentMonthExpenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0);
    const remaining = budget - spent;
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const link = categoryLinks.find(l => l.category === cat.key && l.enabled !== false && l.url);
    return { ...cat, budget, spent, remaining, pct, link };
  });

  return (
    <div ref={containerRef} className="relative space-y-6 pb-20 lg:pb-0">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Expense Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">{MONTHS[now.getMonth()]} {now.getFullYear()}</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          Add Expense
        </Button>
      </motion.div>

      {/* Budget Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {budgetByCategory.map(cat => (
          <Card key={cat.key} className="p-4 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
              <span className="text-xs font-medium truncate flex-1">{cat.label}</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${cat.pct}%`, backgroundColor: cat.pct > 90 ? '#ef4444' : cat.color }}
              />
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-muted-foreground">{formatCurrency(cat.spent)} spent</span>
              <span className={cat.remaining < 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                {formatCurrency(cat.remaining)} left
              </span>
            </div>
            {cat.link && (
              <a
                href={cat.link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full text-[11px] font-medium py-1.5 px-2 rounded-lg transition-colors"
                style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
              >
                <ExternalLink className="w-3 h-3" />
                {cat.link.label || `Open ${cat.label}`}
              </a>
            )}
          </Card>
        ))}
      </div>

      {/* Expense List */}
      <Card className="border-0 shadow-sm p-5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Expenses</h3>
        <AnimatePresence>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 30).map(exp => (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group"
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(exp.category) }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getCategoryLabel(exp.category)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Badge>
                    </div>
                    {exp.notes && <p className="text-xs text-muted-foreground truncate">{exp.notes}</p>}
                  </div>
                  <span className="text-sm font-semibold text-destructive">-{formatCurrency(exp.amount)}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => deleteExpense.mutate(exp.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </Card>

      {/* Add Expense Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Category</Label>
              {/* 8. Mobile Drawer bottom-sheet for Select */}
              <div className="mt-1">
                <MobileSelect
                  value={form.category}
                  onValueChange={v => setForm({ ...form, category: v })}
                  placeholder="Select category"
                  label="Select Category"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.key} value={cat.key}>{cat.label}</option>
                  ))}
                </MobileSelect>
              </div>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="e.g. 500" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea placeholder="What was this expense for?" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.category || !form.amount}>Add Expense</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
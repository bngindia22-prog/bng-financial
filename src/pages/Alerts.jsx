import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  AlertTriangle, Bell, CheckCircle2, XCircle, Info,
  Plus, Trash2, CalendarClock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, MONTHS, CATEGORIES } from '@/lib/constants';
import { useState } from 'react';

export default function Alerts() {
  const [showReminder, setShowReminder] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', type: 'bill', amount: '' });
  const queryClient = useQueryClient();
  const now = new Date();

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes'],
    queryFn: () => base44.entities.MonthlyIncome.list('-created_date', 200),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-date', 200),
  });

  const createReminder = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reminders'] }); setShowReminder(false); setForm({ title: '', date: '', type: 'bill', amount: '' }); },
  });

  const deleteReminder = useMutation({
    mutationFn: (id) => base44.entities.Reminder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });

  // Generate smart alerts
  const alerts = useMemo(() => {
    const result = [];
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const monthIncome = incomes.find(i => i.month === currentMonth && i.year === currentYear);
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });

    // Income not entered
    if (!monthIncome) {
      result.push({ type: 'warning', icon: AlertTriangle, message: `Monthly income not entered for ${MONTHS[currentMonth - 1]}`, color: 'text-amber-600' });
    }

    if (monthIncome) {
      CATEGORIES.forEach(cat => {
        const budget = monthIncome[cat.key] || 0;
        const spent = monthExpenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0);
        if (spent > budget && budget > 0) {
          result.push({ type: 'danger', icon: XCircle, message: `${cat.label} budget exceeded by ${formatCurrency(spent - budget)}`, color: 'text-red-600' });
        }
      });

      // Check unallocated categories
      if (!monthExpenses.some(e => e.category === 'emergency_fund')) {
        result.push({ type: 'info', icon: Info, message: 'Emergency Fund contribution missing this month', color: 'text-blue-600' });
      }
      if (!monthExpenses.some(e => e.category === 'investment')) {
        result.push({ type: 'info', icon: Info, message: 'Investment not updated this month', color: 'text-blue-600' });
      }
      if (!monthExpenses.some(e => e.category === 'charity')) {
        result.push({ type: 'info', icon: Info, message: 'Charity not allocated this month', color: 'text-blue-600' });
      }
    }

    // Upcoming reminders
    const upcoming = reminders.filter(r => {
      const d = new Date(r.date);
      const diff = (d - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 3;
    });
    upcoming.forEach(r => {
      result.push({ type: 'reminder', icon: CalendarClock, message: `Upcoming: ${r.title}${r.amount ? ` - ${formatCurrency(r.amount)}` : ''}`, color: 'text-amber-600' });
    });

    if (result.length === 0) {
      result.push({ type: 'success', icon: CheckCircle2, message: 'All good! Your finances are on track.', color: 'text-emerald-600' });
    }

    return result;
  }, [incomes, expenses, reminders, now]);

  const typeColors = {
    bill: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    emi: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    insurance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    investment: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    other: 'bg-secondary text-secondary-foreground',
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Smart Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">Notifications & reminders</p>
        </div>
        <Button onClick={() => setShowReminder(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Reminder
        </Button>
      </motion.div>

      {/* Alerts */}
      <Card className="border-0 shadow-sm p-5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Financial Alerts
        </h3>
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((alert, idx) => {
              const Icon = alert.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50"
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${alert.color}`} />
                  <span className="text-sm">{alert.message}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </Card>

      {/* Reminders */}
      <Card className="border-0 shadow-sm p-5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Upcoming Reminders</h3>
        {reminders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No reminders set</p>
        ) : (
          <div className="space-y-2">
            {reminders.map(rem => (
              <div key={rem.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors group">
                <CalendarClock className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{rem.title}</span>
                    <Badge className={`text-[10px] ${typeColors[rem.type]}`}>{rem.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(rem.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {rem.amount > 0 && ` · ${formatCurrency(rem.amount)}`}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => deleteReminder.mutate(rem.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Reminder Dialog */}
      <Dialog open={showReminder} onOpenChange={setShowReminder}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Electricity Bill" className="mt-1" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="emi">EMI</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="investment">Investment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (optional)</Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="₹" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReminder(false)}>Cancel</Button>
            <Button onClick={() => createReminder.mutate({ ...form, amount: Number(form.amount) || 0 })} disabled={!form.title || !form.date}>
              Save Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
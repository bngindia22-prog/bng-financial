import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Wallet, IndianRupee, ArrowRight, Pencil, Trash2, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import MonthSummary from '@/components/dashboard/MonthSummary';
import AllocationChart from '@/components/dashboard/AllocationChart';
import HealthScore from '@/components/dashboard/HealthScore';
import IncomeModal from '@/components/dashboard/IncomeModal';
import QuickActions from '@/components/dashboard/QuickActions';
import { formatCurrency, MONTHS, getCategoryLabel, getCategoryColor } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';

export default function Dashboard() {
  const [incomeModal, setIncomeModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: incomes = [], refetch: refetchIncomes } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => base44.entities.MonthlyIncome.filter({ created_by_id: user.id }, '-created_date', 100),
    enabled: !!user,
  });

  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ created_by_id: user.id }, '-created_date', 100),
    enabled: !!user,
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });
  const careNumber = settings.find(s => s.key === 'customer_care_number')?.value || '';

  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh(
    async () => { await Promise.all([refetchIncomes(), refetchExpenses()]); }
  );

  const createIncome = useMutation({
    mutationFn: (data) => base44.entities.MonthlyIncome.create(data),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['incomes', user?.id] });
      const prev = queryClient.getQueryData(['incomes', user?.id]);
      queryClient.setQueryData(['incomes', user?.id], old => [{ ...newItem, id: 'optimistic-' + Date.now() }, ...(old || [])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['incomes', user?.id], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['incomes', user?.id] }),
  });

  const updateIncome = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MonthlyIncome.update(id, data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['incomes', user?.id] }),
  });

  const deleteIncome = useMutation({
    mutationFn: (id) => base44.entities.MonthlyIncome.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['incomes', user?.id] });
      const prev = queryClient.getQueryData(['incomes', user?.id]);
      queryClient.setQueryData(['incomes', user?.id], old => (old || []).filter(i => i.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['incomes', user?.id], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['incomes', user?.id] }),
  });

  const handleIncomeSubmit = (data) => {
    if (editRecord) {
      updateIncome.mutate({ id: editRecord.id, data });
    } else {
      createIncome.mutate(data);
    }
    setEditRecord(null);
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setIncomeModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this income record?')) {
      deleteIncome.mutate(id);
    }
  };

  const currentMonthIncome = incomes.find(i => i.month === currentMonth && i.year === currentYear);
  const thisYearIncomes = incomes.filter(i => i.year === currentYear);
  const monthSpent = expenses
    .filter(e => { const d = new Date(e.date); return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear; })
    .reduce((s, e) => s + (e.amount || 0), 0);

  const todayExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.toDateString() === now.toDateString();
  });
  const todayTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const greeting = now.getHours() < 12 ? 'శుభోదయం · Good Morning' : now.getHours() < 17 ? 'నమస్కారం · Good Afternoon' : 'శుభ సాయంత్రం · Good Evening';
  const firstName = user?.full_name?.split(' ')[0] || '';

  return (
    <div ref={containerRef} className="relative space-y-5 pb-20 lg:pb-0">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />

      {/* Calm Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 pt-1">
        <img
          src="https://media.base44.com/images/public/6a2ee013ed92bb68e2dbaa61/4b023938d_IMG_20260705_083942.png"
          alt="BNG Financial"
          className="w-11 h-11 rounded-xl bg-card border p-1 object-contain"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{greeting}</p>
          <h1 className="text-xl lg:text-2xl font-display font-semibold text-foreground truncate">{firstName || 'Dashboard'}</h1>
        </div>
      </motion.div>

      {/* One clear summary */}
      <MonthSummary monthLabel={MONTHS[currentMonth - 1]} income={currentMonthIncome?.income || 0} spent={monthSpent} />

      {/* Only two actions */}
      <QuickActions onAddIncome={() => { setEditRecord(null); setIncomeModal(true); }} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AllocationChart monthlyIncome={currentMonthIncome} />
        </div>
        <HealthScore monthlyIncomes={thisYearIncomes} expenses={expenses} />
      </div>

      {/* Today's Expenses */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">ఈరోజు ఖర్చులు · Today</h3>
            <Link to="/expenses" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              అన్నీ చూడు <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {todayExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                <Wallet className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">ఈరోజు ఖర్చులు లేవు · No expenses today</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayExpenses.slice(0, 5).map(exp => (
                <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(exp.category) }} />
                    <div>
                      <p className="text-sm font-medium">{getCategoryLabel(exp.category)}</p>
                      {exp.notes && <p className="text-xs text-muted-foreground">{exp.notes}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-destructive">-{formatCurrency(exp.amount)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between mt-2">
                <span className="text-sm font-medium text-muted-foreground">మొత్తం · Total</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(todayTotal)}</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Customer Care */}
      {careNumber && (
        <Card className="p-4 border-0 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Phone className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">సహాయం · Help</p>
                <p className="text-xs text-muted-foreground">Customer Care</p>
              </div>
            </div>
            <a href={`tel:${careNumber}`} className="px-4 py-2 rounded-xl border text-sm font-medium text-foreground">
              {careNumber}
            </a>
          </div>
        </Card>
      )}

      {/* Income History */}
      {incomes.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">ఆదాయ చరిత్ర · Income History</h3>
          <div className="space-y-1">
            {incomes.slice(0, 6).map(record => (
              <div key={record.id} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-secondary/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
                    <IndianRupee className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{MONTHS?.[record.month - 1]} {record.year}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(record.income)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleEdit(record)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(record.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <IncomeModal
        open={incomeModal}
        onOpenChange={(v) => { setIncomeModal(v); if (!v) setEditRecord(null); }}
        onSubmit={handleIncomeSubmit}
        currentMonth={editRecord ? editRecord.month : currentMonth}
        currentYear={editRecord ? editRecord.year : currentYear}
        editRecord={editRecord}
      />
    </div>
  );
}
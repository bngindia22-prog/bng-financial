import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Wallet, Shield, TrendingUp, IndianRupee, ArrowRight, Pencil, Trash2, Headset } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/ui/PullToRefreshIndicator';
import StatCard from '@/components/dashboard/StatCard';
import AllocationChart from '@/components/dashboard/AllocationChart';
import HealthScore from '@/components/dashboard/HealthScore';
import IncomeModal from '@/components/dashboard/IncomeModal';
import { formatCurrency, CATEGORIES, MONTHS, getCategoryLabel, getCategoryColor } from '@/lib/constants';
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
  const totalIncome = thisYearIncomes.reduce((s, i) => s + (i.income || 0), 0);
  const totalSavings = thisYearIncomes.reduce((s, i) => s + (i.emergency_fund || 0) + (i.investment || 0), 0);
  const totalEmergency = thisYearIncomes.reduce((s, i) => s + (i.emergency_fund || 0), 0);
  const totalInvestment = thisYearIncomes.reduce((s, i) => s + (i.investment || 0), 0);

  const todayExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.toDateString() === now.toDateString();
  });
  const todayTotal = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div ref={containerRef} className="relative space-y-6 pb-20 lg:pb-0">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />

      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6 lg:p-8 shadow-xl"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl translate-y-20 -translate-x-10" />
        <div className="relative flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="https://media.base44.com/images/public/6a2ee013ed92bb68e2dbaa61/4b023938d_IMG_20260705_083942.png"
              alt="BNG Financial App"
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-xl bg-white p-1.5 shadow-lg object-contain"
            />
            <div>
              <p className="text-emerald-400 text-sm font-medium">{greeting} 👋</p>
              <h1 className="text-2xl lg:text-3xl font-display font-bold text-white mt-1">Dashboard</h1>
              <p className="text-sm text-slate-300 mt-1">
                Earn Smart. Spend Smart. Save Smart. Build Wealth.
              </p>
            </div>
          </div>
          <Button
            onClick={() => { setEditRecord(null); setIncomeModal(true); }}
            className="gap-2 shadow-lg shadow-emerald-500/30 bg-emerald-500 hover:bg-emerald-400 text-white self-start"
          >
            <Plus className="w-4 h-4" />
            Add Income
          </Button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Monthly Income" value={formatCurrency(currentMonthIncome?.income || 0)} icon={IndianRupee} color="#10b981" subtitle={MONTHS[currentMonth - 1]} index={0} />
        <StatCard title="Total Savings" value={formatCurrency(totalSavings)} icon={Wallet} color="#3b82f6" subtitle={`${currentYear}`} index={1} />
        <StatCard title="Emergency Fund" value={formatCurrency(totalEmergency)} icon={Shield} color="#8b5cf6" subtitle="Accumulated" index={2} />
        <StatCard title="Investment" value={formatCurrency(totalInvestment)} icon={TrendingUp} color="#f59e0b" subtitle="Total Invested" index={3} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AllocationChart monthlyIncome={currentMonthIncome} />
        </div>
        <HealthScore monthlyIncomes={thisYearIncomes} expenses={expenses} />
      </div>

      {/* Today's Expenses & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-semibold text-foreground">Today's Expenses</h3>
            </div>
            <Link to="/expenses" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {todayExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                <Wallet className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No expenses recorded today</p>
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
                <span className="text-sm font-medium text-muted-foreground">Total Today</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(todayTotal)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/expenses" className="group p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 hover:from-emerald-100 hover:to-emerald-200 transition-all text-center border border-emerald-200/50 dark:border-emerald-800/30">
              <Wallet className="w-6 h-6 mx-auto text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Add Expense</span>
            </Link>
            <Link to="/planner" className="group p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 hover:from-blue-100 hover:to-blue-200 transition-all text-center border border-blue-200/50 dark:border-blue-800/30">
              <TrendingUp className="w-6 h-6 mx-auto text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Planner</span>
            </Link>
            <Link to="/reports" className="group p-4 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/20 hover:from-violet-100 hover:to-violet-200 transition-all text-center border border-violet-200/50 dark:border-violet-800/30">
              <IndianRupee className="w-6 h-6 mx-auto text-violet-600 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Reports</span>
            </Link>
            <Link to="/analytics" className="group p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 hover:from-amber-100 hover:to-amber-200 transition-all text-center border border-amber-200/50 dark:border-amber-800/30">
              <Shield className="w-6 h-6 mx-auto text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Analytics</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* Customer Care */}
      {careNumber && (
        <Card className="p-4 border-0 shadow-sm overflow-hidden relative bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/20">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Headset className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Customer Care</p>
                <p className="text-xs text-muted-foreground">Need help? Call us</p>
              </div>
            </div>
            <a href={`tel:${careNumber}`} className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md shadow-emerald-500/20">
              {careNumber}
            </a>
          </div>
        </Card>
      )}

      {/* Income History */}
      {incomes.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-violet-500" />
            <h3 className="text-sm font-semibold text-foreground">Income History</h3>
          </div>
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
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
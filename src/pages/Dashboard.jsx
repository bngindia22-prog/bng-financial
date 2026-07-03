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

  // 9. Pull-to-refresh
  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh(
    async () => { await Promise.all([refetchIncomes(), refetchExpenses()]); }
  );

  // 5. Optimistic UI for income creation
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

  return (
    <div ref={containerRef} className="relative space-y-6 pb-20 lg:pb-0">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} threshold={threshold} />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn Smart. Spend Smart. Save Smart. Build Wealth.
          </p>
        </div>
        <Button onClick={() => { setEditRecord(null); setIncomeModal(true); }} className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" />
          Add Income
        </Button>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Monthly Income" value={formatCurrency(currentMonthIncome?.income || 0)} icon={IndianRupee} color="#10b981" index={0} />
        <StatCard title="Total Savings" value={formatCurrency(totalSavings)} icon={Wallet} color="#3b82f6" subtitle={`${currentYear}`} index={1} />
        <StatCard title="Emergency Fund" value={formatCurrency(totalEmergency)} icon={Shield} color="#8b5cf6" index={2} />
        <StatCard title="Investment" value={formatCurrency(totalInvestment)} icon={TrendingUp} color="#f59e0b" index={3} />
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
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Today's Expenses</h3>
            <Link to="/expenses" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {todayExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No expenses recorded today</p>
          ) : (
            <div className="space-y-2.5">
              {todayExpenses.slice(0, 5).map(exp => (
                <div key={exp.id} className="flex items-center justify-between">
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
              <div className="border-t pt-2 flex justify-between">
                <span className="text-sm font-medium">Total Today</span>
                <span className="text-sm font-bold">{formatCurrency(todayTotal)}</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5 border-0 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/expenses" className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-center">
              <Wallet className="w-6 h-6 mx-auto text-emerald-600 mb-2" />
              <span className="text-xs font-medium">Add Expense</span>
            </Link>
            <Link to="/planner" className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-center">
              <TrendingUp className="w-6 h-6 mx-auto text-blue-600 mb-2" />
              <span className="text-xs font-medium">Planner</span>
            </Link>
            <Link to="/reports" className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-center">
              <IndianRupee className="w-6 h-6 mx-auto text-violet-600 mb-2" />
              <span className="text-xs font-medium">Reports</span>
            </Link>
            <Link to="/analytics" className="p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors text-center">
              <Shield className="w-6 h-6 mx-auto text-amber-600 mb-2" />
              <span className="text-xs font-medium">Analytics</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* Customer Care */}
      {careNumber && (
        <Card className="p-4 border-0 shadow-sm bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Headset className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Customer Care</p>
                <p className="text-xs text-muted-foreground">Need help? Call us</p>
              </div>
            </div>
            <a href={`tel:${careNumber}`} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              {careNumber}
            </a>
          </div>
        </Card>
      )}

      {/* Income History */}
      {incomes.length > 0 && (
        <Card className="p-5 border-0 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Income History</h3>
          <div className="space-y-2">
            {incomes.slice(0, 6).map(record => (
              <div key={record.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-semibold">{MONTHS?.[record.month - 1]} {record.year}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(record.income)}</p>
                </div>
                <div className="flex gap-2">
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
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Wallet, Shield, TrendingUp, IndianRupee, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import StatCard from '@/components/dashboard/StatCard';
import AllocationChart from '@/components/dashboard/AllocationChart';
import HealthScore from '@/components/dashboard/HealthScore';
import IncomeModal from '@/components/dashboard/IncomeModal';
import { formatCurrency, CATEGORIES, getCategoryLabel, getCategoryColor } from '@/lib/constants';

export default function Dashboard() {
  const [incomeModal, setIncomeModal] = useState(false);
  const queryClient = useQueryClient();
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes'],
    queryFn: () => base44.entities.MonthlyIncome.list('-created_date', 100),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 100),
  });

  const createIncome = useMutation({
    mutationFn: (data) => base44.entities.MonthlyIncome.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incomes'] }),
  });

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
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn Smart. Spend Smart. Save Smart. Build Wealth.
          </p>
        </div>
        <Button onClick={() => setIncomeModal(true)} className="gap-2 shadow-lg shadow-primary/20">
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

      <IncomeModal
        open={incomeModal}
        onOpenChange={setIncomeModal}
        onSubmit={(data) => createIncome.mutate(data)}
        currentMonth={currentMonth}
        currentYear={currentYear}
      />
    </div>
  );
}
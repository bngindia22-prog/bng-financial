import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { MONTHS, CATEGORIES, formatCurrency, MONTH_SHORT } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';

export default function Analytics() {
  const { user } = useAuth();

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => base44.entities.MonthlyIncome.filter({ created_by_id: user.id }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ created_by_id: user.id }, '-date', 500),
    enabled: !!user,
  });

  const year = new Date().getFullYear();
  const yearIncomes = incomes.filter(i => i.year === year);

  // Income Trend
  const incomeTrend = MONTH_SHORT.map((label, idx) => {
    const m = yearIncomes.find(i => i.month === idx + 1);
    return { name: label, income: m?.income || 0 };
  });

  // Expense Trend
  const expenseTrend = MONTH_SHORT.map((label, idx) => {
    const monthExpenses = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === idx && d.getFullYear() === year;
    });
    return { name: label, expenses: monthExpenses.reduce((s, e) => s + (e.amount || 0), 0) };
  });

  // Savings Growth
  const savingsGrowth = MONTH_SHORT.map((label, idx) => {
    const m = yearIncomes.find(i => i.month === idx + 1);
    const monthExp = expenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === idx && d.getFullYear() === year;
    }).reduce((s, e) => s + (e.amount || 0), 0);
    return { name: label, savings: (m?.income || 0) - monthExp };
  });

  // Emergency Fund Growth
  const emergencyGrowth = MONTH_SHORT.map((label, idx) => {
    const total = yearIncomes.filter(i => i.month <= idx + 1).reduce((s, i) => s + (i.emergency_fund || 0), 0);
    return { name: label, fund: total };
  });

  // Investment Growth
  const investmentGrowth = MONTH_SHORT.map((label, idx) => {
    const total = yearIncomes.filter(i => i.month <= idx + 1).reduce((s, i) => s + (i.investment || 0), 0);
    return { name: label, investment: total };
  });

  // Category Spending Pie
  const categorySpending = CATEGORIES.map(cat => ({
    name: cat.label,
    value: expenses.filter(e => e.category === cat.key && new Date(e.date).getFullYear() === year).reduce((s, e) => s + (e.amount || 0), 0),
    color: cat.color,
  })).filter(d => d.value > 0);

  const chartStyle = {
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-display font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial insights for {year}</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Income Trend */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Income Trend</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={incomeTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Expense Trend */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Expense Trend</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={expenseTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Savings Growth */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Savings Growth</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={savingsGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                <Bar dataKey="savings" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Emergency Fund Growth */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Emergency Fund Growth</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={emergencyGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                <Line type="monotone" dataKey="fund" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Investment Growth */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Investment Growth</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={investmentGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                <Line type="monotone" dataKey="investment" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Spending Pie */}
        <Card className="border-0 shadow-sm p-5">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Category Spending</h3>
          <div className="h-64 flex items-center justify-center">
            {categorySpending.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categorySpending} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {categorySpending.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={chartStyle} />
                  <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No expense data yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
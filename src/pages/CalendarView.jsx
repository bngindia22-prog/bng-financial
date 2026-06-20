import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MONTHS, formatCurrency, getCategoryColor, getCategoryLabel } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const { user } = useAuth();

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', user?.id],
    queryFn: () => base44.entities.Expense.filter({ created_by_id: user.id }, '-date', 500),
    enabled: !!user,
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes', user?.id],
    queryFn: () => base44.entities.MonthlyIncome.filter({ created_by_id: user.id }, '-created_date', 200),
    enabled: !!user,
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: () => base44.entities.Reminder.filter({ created_by_id: user.id }, '-date', 200),
    enabled: !!user,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDayData = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayExpenses = expenses.filter(e => e.date === dateStr);
    const dayReminders = reminders.filter(r => r.date === dateStr);
    const hasIncome = incomes.some(i => i.month === month + 1 && i.year === year);
    return { expenses: dayExpenses, reminders: dayReminders, hasIncome: hasIncome && day === 1 };
  };

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectedData = selectedDay ? getDayData(selectedDay) : null;

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl lg:text-3xl font-display font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">Track expenses, income & reminders</p>
      </motion.div>

      <Card className="border-0 shadow-sm p-5">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-display font-bold">{MONTHS[month]} {year}</h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Income</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> Expense</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Reminder</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Investment</div>
        </div>

        {/* Week Headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const data = getDayData(day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const isSelected = selectedDay === day;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={`relative aspect-square rounded-xl p-1 text-sm font-medium transition-all hover:bg-secondary ${
                  isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'bg-secondary ring-2 ring-primary' : ''
                }`}
              >
                <span className="text-xs">{day}</span>
                <div className="flex gap-0.5 justify-center mt-0.5 flex-wrap">
                  {data.hasIncome && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                  {data.expenses.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                  {data.reminders.length > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  {data.expenses.some(e => e.category === 'investment') && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Selected Day Details */}
      {selectedData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 shadow-sm p-5">
            <h3 className="font-display font-bold mb-4">
              {selectedDay} {MONTHS[month]} {year}
            </h3>
            
            {selectedData.hasIncome && (
              <div className="mb-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  💰 Monthly income recorded
                </p>
              </div>
            )}

            {selectedData.expenses.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expenses</p>
                {selectedData.expenses.map(exp => (
                  <div key={exp.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(exp.category) }} />
                    <span className="text-sm flex-1">{getCategoryLabel(exp.category)}</span>
                    <span className="text-sm font-semibold text-destructive">{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">No expenses on this day</p>
            )}

            {selectedData.reminders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reminders</p>
                {selectedData.reminders.map(rem => (
                  <div key={rem.id} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{rem.title}</p>
                    {rem.amount > 0 && <p className="text-xs text-amber-600">{formatCurrency(rem.amount)}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
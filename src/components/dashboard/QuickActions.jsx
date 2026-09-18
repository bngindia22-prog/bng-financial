import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';

const base = 'flex items-center justify-center gap-3 h-14 rounded-2xl text-base font-semibold active:scale-[0.98] transition-transform';

export default function QuickActions({ onAddIncome }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button type="button" onClick={onAddIncome} className={`${base} bg-primary text-primary-foreground shadow-sm`}>
        <Plus className="w-5 h-5" />
        <span>ఆదాయం<span className="hidden sm:inline"> · Income</span></span>
      </button>
      <Link to="/expenses" className={`${base} bg-card text-foreground border shadow-sm`}>
        <Receipt className="w-5 h-5 text-muted-foreground" />
        <span>ఖర్చు<span className="hidden sm:inline"> · Expense</span></span>
      </Link>
    </div>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Minus, Download, CalendarDays, BarChart3, Loader2, ChevronRight } from 'lucide-react';

const tileBase = 'flex items-center gap-4 p-4 rounded-2xl text-white shadow-lg active:scale-[0.98] transition-transform text-left w-full';

function Tile({ icon: Icon, title, subtitle, className, to, onClick, loading }) {
  const inner = (
    <>
      <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
        {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : <Icon className="w-7 h-7" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold leading-tight">{title}</p>
        <p className="text-sm text-white/85 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-white/70 shrink-0" />
    </>
  );
  if (to) return <Link to={to} className={`${tileBase} ${className}`}>{inner}</Link>;
  return <button type="button" onClick={onClick} disabled={loading} className={`${tileBase} ${className} disabled:opacity-70`}>{inner}</button>;
}

export default function QuickActions({ onAddIncome, onDownloadReport, downloading }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">ఏం చేయాలి? · What do you want to do?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Tile icon={Plus} title="ఆదాయం జోడించు" subtitle="Add Income · నెల జీతం నమోదు" className="bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/30" onClick={onAddIncome} />
        <Tile icon={Minus} title="ఖర్చు జోడించు" subtitle="Add Expense · రోజువారీ ఖర్చు" className="bg-gradient-to-r from-rose-500 to-rose-600 shadow-rose-500/30" to="/expenses" />
        <Tile icon={Download} title="రిపోర్ట్ డౌన్‌లోడ్" subtitle="Download PDF · ఈ నెల రిపోర్ట్" className="bg-gradient-to-r from-violet-500 to-violet-600 shadow-violet-500/30" onClick={onDownloadReport} loading={downloading} />
        <Tile icon={CalendarDays} title="రిమైండర్లు" subtitle="Calendar · బిల్లులు & EMI" className="bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/30" to="/calendar" />
        <Tile icon={BarChart3} title="విశ్లేషణ" subtitle="Analytics · ఖర్చుల ట్రెండ్" className="bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-500/30 sm:col-span-2" to="/analytics" />
      </div>
    </div>
  );
}
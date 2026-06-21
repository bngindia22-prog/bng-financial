import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, TrendingUp, BarChart3, Sheet, ExternalLink, Link2Off, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MONTHS, CATEGORIES, formatCurrency, calculateHealthScore, getHealthLabel } from '@/lib/constants';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

const CONNECTOR_ID = '6a3804f81c2495bbfdf2eae7';

export default function Reports() {
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [lastSheetUrl, setLastSheetUrl] = useState(null);

  // Check connection by trying the function
  useEffect(() => {
    if (!user) return;
    base44.functions.invoke('exportToGoogleSheets', { checkOnly: true })
      .then(() => setSheetsConnected(true))
      .catch(() => setSheetsConnected(false));
  }, [user]);

  const handleConnectSheets = async () => {
    setSheetsLoading(true);
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    const popup = window.open(url, '_blank');
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        // Re-check connection
        base44.functions.invoke('exportToGoogleSheets', { checkOnly: true })
          .then(() => setSheetsConnected(true))
          .catch(() => setSheetsConnected(false))
          .finally(() => setSheetsLoading(false));
      }
    }, 500);
  };

  const handleDisconnectSheets = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setSheetsConnected(false);
    setLastSheetUrl(null);
  };

  const handleExportToSheets = async () => {
    setExportLoading(true);
    const monthNum = Number(selectedMonth);
    const data = getMonthlyData(monthNum);
    try {
      const res = await base44.functions.invoke('exportToGoogleSheets', {
        month: monthNum,
        year,
        incomeData: data.income || null,
        expenseData: data.expenses,
      });
      setLastSheetUrl(res.data.spreadsheetUrl);
      toast({ title: 'Exported to Google Sheets!', description: res.data.title });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message, variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

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

  const yearIncomes = incomes.filter(i => i.year === year);
  const yearExpenses = expenses.filter(e => new Date(e.date).getFullYear() === year);

  const getMonthlyData = (month) => {
    const m = yearIncomes.find(i => i.month === month);
    const monthExp = yearExpenses.filter(e => new Date(e.date).getMonth() + 1 === month);
    const totalExp = monthExp.reduce((s, e) => s + (e.amount || 0), 0);
    return { income: m, expenses: monthExp, totalExpenses: totalExp };
  };

  const handleDownload = async () => {
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('BNG Financial Maintenance', 20, 20);
    doc.setFontSize(10);
    doc.text(`Report Type: ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`, 20, 30);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 20, 36);

    let y = 50;

    if (reportType === 'monthly') {
      const data = getMonthlyData(Number(selectedMonth));
      doc.setFontSize(14);
      doc.text(`${MONTHS[Number(selectedMonth) - 1]} ${year}`, 20, y);
      y += 12;
      doc.setFontSize(10);
      doc.text(`Total Income: ${formatCurrency(data.income?.income || 0)}`, 20, y); y += 8;
      doc.text(`Total Expenses: ${formatCurrency(data.totalExpenses)}`, 20, y); y += 8;
      doc.text(`Net Savings: ${formatCurrency((data.income?.income || 0) - data.totalExpenses)}`, 20, y); y += 14;

      doc.setFontSize(12);
      doc.text('Allocation Breakdown:', 20, y); y += 10;
      doc.setFontSize(10);
      CATEGORIES.forEach(cat => {
        doc.text(`${cat.label} (${cat.percentage}%): ${formatCurrency(data.income?.[cat.key] || 0)}`, 25, y);
        y += 7;
      });
    } else if (reportType === 'annual') {
      doc.setFontSize(14);
      doc.text(`Annual Report ${year}`, 20, y); y += 12;
      const totalIncome = yearIncomes.reduce((s, i) => s + (i.income || 0), 0);
      const totalExp = yearExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      doc.setFontSize(10);
      doc.text(`Total Income: ${formatCurrency(totalIncome)}`, 20, y); y += 8;
      doc.text(`Total Expenses: ${formatCurrency(totalExp)}`, 20, y); y += 8;
      doc.text(`Net Savings: ${formatCurrency(totalIncome - totalExp)}`, 20, y); y += 8;

      const score = calculateHealthScore(yearIncomes, yearExpenses);
      const { label } = getHealthLabel(score);
      doc.text(`Financial Health Score: ${score}/100 (${label})`, 20, y); y += 14;

      doc.setFontSize(12);
      doc.text('Monthly Breakdown:', 20, y); y += 10;
      doc.setFontSize(9);
      MONTHS.forEach((m, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const mi = yearIncomes.find(i => i.month === idx + 1);
        doc.text(`${m}: Income ${formatCurrency(mi?.income || 0)}`, 25, y);
        y += 6;
      });
    }

    doc.save(`BNG_${reportType}_report_${year}.pdf`);
  };

  const currentData = getMonthlyData(Number(selectedMonth));
  const score = calculateHealthScore(yearIncomes, yearExpenses);
  const { label: healthLabel, color: healthColor } = getHealthLabel(score);

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and download financial reports</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          {sheetsConnected ? (
            <div className="flex gap-2">
              <Button onClick={handleExportToSheets} disabled={exportLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4" />}
                Export to Sheets
              </Button>
              {lastSheetUrl && (
                <Button variant="outline" size="icon" onClick={() => window.open(lastSheetUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleDisconnectSheets} title="Disconnect Google Sheets">
                <Link2Off className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnectSheets} disabled={sheetsLoading} variant="outline" className="gap-2">
              {sheetsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sheet className="w-4 h-4 text-emerald-600" />}
              Connect Google Sheets
            </Button>
          )}
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
        {reportType === 'monthly' && (
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Report Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-xl font-display font-bold">{formatCurrency(currentData.income?.income || 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-display font-bold">{formatCurrency(currentData.totalExpenses)}</p>
            </div>
          </div>
        </Card>

        <Card className="border-0 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Health Score</p>
              <p className={`text-xl font-display font-bold ${healthColor}`}>{score}/100 ({healthLabel})</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Allocation Table */}
      <Card className="border-0 shadow-sm p-5">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Allocation Details</h3>
        <div className="space-y-3">
          {CATEGORIES.map(cat => {
            const allocated = currentData.income?.[cat.key] || 0;
            const spent = currentData.expenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0);
            return (
              <div key={cat.key} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-sm flex-1">{cat.label} ({cat.percentage}%)</span>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(allocated)}</p>
                  <p className="text-xs text-muted-foreground">Spent: {formatCurrency(spent)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
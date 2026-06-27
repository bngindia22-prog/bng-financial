import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, TrendingUp, BarChart3, Sheet, ExternalLink, Link2Off, Loader2, Presentation } from 'lucide-react';
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

  // Check connection status via backend function
  useEffect(() => {
    if (!user) return;
    base44.functions.invoke('exportToGoogleSheets', { checkOnly: true })
      .then(() => setSheetsConnected(true))
      .catch(() => setSheetsConnected(false));
  }, [user]);

  const handleConnectSheets = async () => {
    setSheetsLoading(true);
    try {
      const returnUrl = window.location.href;
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID, { returnUrl });
      window.location.href = url;
    } catch (e) {
      setSheetsLoading(false);
      toast({ title: 'Connection failed', description: e.message, variant: 'destructive' });
    }
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

  const handleDownloadPPT = async () => {
    const pptxgen = (await import('pptxgenjs')).default;
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'BNG Financial Maintenance';
    pptx.company = 'BNG Financial';
    pptx.subject = 'Financial Report';

    const GREEN = '10B981';
    const DARK = '1E293B';
    const MUTED = '64748B';
    const LIGHT_BG = 'F1F5F9';
    const RED = 'EF4444';
    const BLUE = '3B82F6';

    // Slide 1 — Title
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: DARK };
    titleSlide.addText('BNG Financial Maintenance', { x: 0.5, y: 1.8, w: 12, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri' });
    const reportLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
    titleSlide.addText(`${reportLabel} Financial Report`, { x: 0.5, y: 2.8, w: 12, h: 0.6, fontSize: 24, color: GREEN, align: 'center' });
    titleSlide.addText(`${reportType === 'annual' ? `Year ${year}` : `${MONTHS[Number(selectedMonth) - 1]} ${year}`}`, { x: 0.5, y: 3.4, w: 12, h: 0.5, fontSize: 18, color: 'CBD5E1', align: 'center' });
    titleSlide.addText(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { x: 0.5, y: 4.2, w: 12, h: 0.4, fontSize: 12, color: '94A3B8', align: 'center' });

    // Slide 2 — Summary
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: 'FFFFFF' };
    summarySlide.addText('Financial Summary', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: DARK });
    summarySlide.addShape('rect', { x: 0.5, y: 0.95, w: 12, h: 0.04, fill: { color: GREEN } });

    if (reportType === 'annual') {
      const totalIncome = yearIncomes.reduce((s, i) => s + (i.income || 0), 0);
      const totalExp = yearExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const netSavings = totalIncome - totalExp;
      summarySlide.addText('Total Income', { x: 0.5, y: 1.3, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(totalIncome), { x: 0.5, y: 1.7, w: 5.8, h: 0.5, fontSize: 22, color: GREEN, bold: true });
      summarySlide.addText('Total Expenses', { x: 6.7, y: 1.3, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(totalExp), { x: 6.7, y: 1.7, w: 5.8, h: 0.5, fontSize: 22, color: RED, bold: true });
      summarySlide.addText('Net Savings', { x: 0.5, y: 2.5, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(netSavings), { x: 0.5, y: 2.9, w: 5.8, h: 0.5, fontSize: 22, color: BLUE, bold: true });
      summarySlide.addText('Health Score', { x: 6.7, y: 2.5, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(`${score}/100 (${healthLabel})`, { x: 6.7, y: 2.9, w: 5.8, h: 0.5, fontSize: 22, color: DARK, bold: true });
    } else {
      const data = getMonthlyData(Number(selectedMonth));
      const netSavings = (data.income?.income || 0) - data.totalExpenses;
      summarySlide.addText('Total Income', { x: 0.5, y: 1.3, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(data.income?.income || 0), { x: 0.5, y: 1.7, w: 5.8, h: 0.5, fontSize: 22, color: GREEN, bold: true });
      summarySlide.addText('Total Expenses', { x: 6.7, y: 1.3, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(data.totalExpenses), { x: 6.7, y: 1.7, w: 5.8, h: 0.5, fontSize: 22, color: RED, bold: true });
      summarySlide.addText('Net Savings', { x: 0.5, y: 2.5, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(formatCurrency(netSavings), { x: 0.5, y: 2.9, w: 5.8, h: 0.5, fontSize: 22, color: BLUE, bold: true });
      summarySlide.addText('Health Score', { x: 6.7, y: 2.5, w: 5.8, h: 0.4, fontSize: 14, color: MUTED, bold: true });
      summarySlide.addText(`${score}/100 (${healthLabel})`, { x: 6.7, y: 2.9, w: 5.8, h: 0.5, fontSize: 22, color: DARK, bold: true });
    }

    // Slide 3 — Allocation Breakdown
    const allocSlide = pptx.addSlide();
    allocSlide.background = { color: 'FFFFFF' };
    allocSlide.addText('Six-Point Allocation Breakdown', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: DARK });
    allocSlide.addShape('rect', { x: 0.5, y: 0.95, w: 12, h: 0.04, fill: { color: GREEN } });

    const allocRows = [
      [{ text: 'Category', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
       { text: 'Allocation %', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
       { text: 'Allocated', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
       { text: 'Spent', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
       { text: 'Remaining', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } }],
    ];

    const dataForAlloc = reportType === 'annual'
      ? { income: { home_needs: yearIncomes.reduce((s, i) => s + (i.home_needs || 0), 0), emergency_fund: yearIncomes.reduce((s, i) => s + (i.emergency_fund || 0), 0), investment: yearIncomes.reduce((s, i) => s + (i.investment || 0), 0), learning: yearIncomes.reduce((s, i) => s + (i.learning || 0), 0), luxury: yearIncomes.reduce((s, i) => s + (i.luxury || 0), 0), charity: yearIncomes.reduce((s, i) => s + (i.charity || 0), 0) }, expenses: yearExpenses }
      : getMonthlyData(Number(selectedMonth));

    CATEGORIES.forEach(cat => {
      const allocated = dataForAlloc.income?.[cat.key] || 0;
      const spent = dataForAlloc.expenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0);
      const remaining = allocated - spent;
      allocRows.push([
        cat.label,
        `${cat.percentage}%`,
        formatCurrency(allocated),
        formatCurrency(spent),
        formatCurrency(remaining),
      ]);
    });

    allocSlide.addTable(allocRows, {
      x: 0.5, y: 1.2, w: 12,
      colW: [3.5, 2, 2.5, 2.5, 2.5],
      fontSize: 12,
      rowH: 0.4,
      align: 'left',
      valign: 'middle',
      border: { type: 'solid', pt: 1, color: 'E2E8F0' },
      autoPage: true,
    });

    // Slide 4 — Monthly Breakdown (annual) or Expense Details (monthly)
    if (reportType === 'annual') {
      const monthlySlide = pptx.addSlide();
      monthlySlide.background = { color: 'FFFFFF' };
      monthlySlide.addText('Monthly Income Breakdown', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: DARK });
      monthlySlide.addShape('rect', { x: 0.5, y: 0.95, w: 12, h: 0.04, fill: { color: GREEN } });

      const monthlyRows = [
        [{ text: 'Month', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
         { text: 'Income', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
         { text: 'Expenses', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
         { text: 'Savings', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } }],
      ];

      MONTHS.forEach((m, idx) => {
        const mi = yearIncomes.find(i => i.month === idx + 1);
        const me = yearExpenses.filter(e => new Date(e.date).getMonth() + 1 === idx + 1).reduce((s, e) => s + (e.amount || 0), 0);
        const income = mi?.income || 0;
        monthlyRows.push([m, formatCurrency(income), formatCurrency(me), formatCurrency(income - me)]);
      });

      monthlySlide.addTable(monthlyRows, {
        x: 0.5, y: 1.2, w: 12,
        colW: [3, 3, 3, 3],
        fontSize: 11,
        rowH: 0.35,
        align: 'left',
        valign: 'middle',
        border: { type: 'solid', pt: 1, color: 'E2E8F0' },
        autoPage: true,
      });
    } else {
      const expSlide = pptx.addSlide();
      expSlide.background = { color: 'FFFFFF' };
      expSlide.addText('Expense Details', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, bold: true, color: DARK });
      expSlide.addShape('rect', { x: 0.5, y: 0.95, w: 12, h: 0.04, fill: { color: GREEN } });

      const monthExp = getMonthlyData(Number(selectedMonth)).expenses;
      if (monthExp.length === 0) {
        expSlide.addText('No expenses recorded for this month.', { x: 0.5, y: 1.5, w: 12, h: 0.5, fontSize: 16, color: MUTED, align: 'center' });
      } else {
        const expRows = [
          [{ text: 'Date', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
           { text: 'Category', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
           { text: 'Amount', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } },
           { text: 'Notes', options: { bold: true, fill: { color: DARK }, color: 'FFFFFF' } }],
        ];
        monthExp.forEach(e => {
          expRows.push([
            new Date(e.date).toLocaleDateString('en-IN'),
            CATEGORIES.find(c => c.key === e.category)?.label || e.category,
            formatCurrency(e.amount),
            e.notes || '-',
          ]);
        });
        expSlide.addTable(expRows, {
          x: 0.5, y: 1.2, w: 12,
          colW: [2.5, 3, 2.5, 4],
          fontSize: 11,
          rowH: 0.35,
          align: 'left',
          valign: 'middle',
          border: { type: 'solid', pt: 1, color: 'E2E8F0' },
          autoPage: true,
        });
      }
    }

    // Slide — Footer/Method
    const footerSlide = pptx.addSlide();
    footerSlide.background = { color: LIGHT_BG };
    footerSlide.addText('Six-Point Financial Allocation Method', { x: 0.5, y: 0.8, w: 12, h: 0.6, fontSize: 24, bold: true, color: DARK, align: 'center' });
    const methodText = [
      { text: '50% Home Needs  •  15% Emergency Fund  •  10% Investment\n', options: { fontSize: 16, color: DARK, align: 'center', breakLine: true } },
      { text: '10% Learning  •  10% Luxury  •  5% Charity', options: { fontSize: 16, color: DARK, align: 'center' } },
    ];
    footerSlide.addText(methodText, { x: 0.5, y: 1.8, w: 12, h: 1.2 });
    footerSlide.addText('Earn Smart. Spend Smart. Save Smart. Build Wealth.', { x: 0.5, y: 3.5, w: 12, h: 0.5, fontSize: 14, color: GREEN, italic: true, align: 'center' });

    await pptx.writeFile({ fileName: `BNG_${reportType}_report_${year}.pptx` });
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
          <Button onClick={handleDownloadPPT} variant="outline" className="gap-2">
            <Presentation className="w-4 h-4" />
            Download PPT
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
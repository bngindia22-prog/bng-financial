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
import jsPDF from 'jspdf';
import pptxgen from 'pptxgenjs';

const CONNECTOR_ID = '6a3804f81c2495bbfdf2eae7';

const downloadFile = async (blob, filename, mime) => {
  // Method 1: Web Share API with timeout (best for mobile/WebView)
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      const sharePromise = navigator.share({ files: [file], title: filename });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Share timeout')), 8000)
      );
      await Promise.race([sharePromise, timeoutPromise]);
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    // Fall through to anchor download
  }
  // Method 2: Anchor download with blob URL
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
  // Method 3: window.open as last resort (some WebViews handle this)
  setTimeout(() => {
    try { window.open(url, '_blank'); } catch (e) { /* ignore */ }
  }, 100);
  return true;
};

const getQrDataUrl = async (text, size = 150) => {
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(text)}&size=${size}x${size}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
};

export default function Reports() {
  const [reportType, setReportType] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const { toast } = useToast();
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);
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

  const addPdfWatermark = (doc) => {
    try {
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.saveGraphicsState();
        if (doc.GState) {
          doc.setGState(new doc.GState({ opacity: 0.08 }));
        }
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(72);
        doc.setFont('helvetica', 'bold');
        doc.text('BNG', 105, 160, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
      }
    } catch (e) {
      // Watermark is optional - don't block the download
    }
  };

  const handleDownload = async () => {
    setPdfLoading(true);
    try {
    const doc = new jsPDF();
    const qrDataUrl = await getQrDataUrl('https://wa.me/919652953160', 150);
    const pageWidth = 210;
    const margin = 20;
    let y = 20;

    // Header band
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BNG Financial Maintenance', margin, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const reportLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
    doc.text(`${reportLabel} Financial Report`, margin, 24);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 24, { align: 'right' });

    y = 44;
    doc.setTextColor(30, 41, 59);

    // Section helper
    const addSectionTitle = (title) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(title, margin, y);
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, pageWidth - margin, y + 2);
      y += 10;
      doc.setTextColor(30, 41, 59);
    };

    // Summary section
    addSectionTitle('Financial Summary');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (reportType === 'annual') {
      const totalIncome = yearIncomes.reduce((s, i) => s + (i.income || 0), 0);
      const totalExp = yearExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const netSavings = totalIncome - totalExp;
      doc.text(`Total Income:    ${formatCurrency(totalIncome)}`, margin, y); y += 7;
      doc.text(`Total Expenses:  ${formatCurrency(totalExp)}`, margin, y); y += 7;
      doc.text(`Net Savings:     ${formatCurrency(netSavings)}`, margin, y); y += 7;
      doc.text(`Health Score:    ${score}/100 (${healthLabel})`, margin, y); y += 12;
    } else {
      const data = getMonthlyData(Number(selectedMonth));
      const netSavings = (data.income?.income || 0) - data.totalExpenses;
      doc.text(`Total Income:    ${formatCurrency(data.income?.income || 0)}`, margin, y); y += 7;
      doc.text(`Total Expenses:  ${formatCurrency(data.totalExpenses)}`, margin, y); y += 7;
      doc.text(`Net Savings:     ${formatCurrency(netSavings)}`, margin, y); y += 7;
      doc.text(`Health Score:    ${score}/100 (${healthLabel})`, margin, y); y += 12;
    }

    // Allocation Breakdown section
    addSectionTitle('Six-Point Allocation Breakdown');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Category', margin, y);
    doc.text('%', 80, y);
    doc.text('Allocated', 100, y);
    doc.text('Spent', 135, y);
    doc.text('Remaining', 165, y);
    y += 5;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    const dataForAlloc = reportType === 'annual'
      ? { income: { home_needs: yearIncomes.reduce((s, i) => s + (i.home_needs || 0), 0), emergency_fund: yearIncomes.reduce((s, i) => s + (i.emergency_fund || 0), 0), investment: yearIncomes.reduce((s, i) => s + (i.investment || 0), 0), learning: yearIncomes.reduce((s, i) => s + (i.learning || 0), 0), luxury: yearIncomes.reduce((s, i) => s + (i.luxury || 0), 0), charity: yearIncomes.reduce((s, i) => s + (i.charity || 0), 0) }, expenses: yearExpenses }
      : getMonthlyData(Number(selectedMonth));

    CATEGORIES.forEach(cat => {
      if (y > 270) { doc.addPage(); y = 20; }
      const allocated = dataForAlloc.income?.[cat.key] || 0;
      const spent = dataForAlloc.expenses.filter(e => e.category === cat.key).reduce((s, e) => s + (e.amount || 0), 0);
      const remaining = allocated - spent;
      doc.text(cat.label, margin, y);
      doc.text(`${cat.percentage}%`, 80, y);
      doc.text(formatCurrency(allocated), 100, y);
      doc.text(formatCurrency(spent), 135, y);
      doc.text(formatCurrency(remaining), 165, y);
      y += 7;
    });
    y += 8;

    // Monthly Breakdown (annual) or Expense Details (monthly)
    if (reportType === 'annual') {
      addSectionTitle('Monthly Income Breakdown');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Month', margin, y);
      doc.text('Income', 80, y);
      doc.text('Expenses', 120, y);
      doc.text('Savings', 160, y);
      y += 5;
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      MONTHS.forEach((m, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const mi = yearIncomes.find(i => i.month === idx + 1);
        const me = yearExpenses.filter(e => new Date(e.date).getMonth() + 1 === idx + 1).reduce((s, e) => s + (e.amount || 0), 0);
        const income = mi?.income || 0;
        doc.text(m, margin, y);
        doc.text(formatCurrency(income), 80, y);
        doc.text(formatCurrency(me), 120, y);
        doc.text(formatCurrency(income - me), 160, y);
        y += 6;
      });
    } else {
      addSectionTitle('Expense Details');
      const monthExp = getMonthlyData(Number(selectedMonth)).expenses;
      if (monthExp.length === 0) {
        doc.setFontSize(10);
        doc.text('No expenses recorded for this month.', margin, y);
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Date', margin, y);
        doc.text('Category', 60, y);
        doc.text('Amount', 120, y);
        doc.text('Notes', 155, y);
        y += 5;
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        monthExp.forEach(e => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.text(new Date(e.date).toLocaleDateString('en-IN'), margin, y);
          doc.text(CATEGORIES.find(c => c.key === e.category)?.label || e.category, 60, y);
          doc.text(formatCurrency(e.amount), 120, y);
          doc.text((e.notes || '-').substring(0, 35), 155, y);
          y += 6;
        });
      }
    }

    // Footer / Method
    y += 12;
    if (y > 250) { doc.addPage(); y = 20; }
    addSectionTitle('Six-Point Financial Allocation Method');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('50% Home Needs   15% Emergency Fund   10% Investment', margin, y); y += 7;
    doc.text('10% Learning   10% Luxury   5% Charity', margin, y); y += 7;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(16, 185, 129);
    doc.text('Earn Smart. Spend Smart. Save Smart. Build Wealth.', margin, y);

    // WhatsApp QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', pageWidth - 42, y - 28, 25, 25);
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Scan for WhatsApp', pageWidth - 29.5, y + 2, { align: 'center' });
    }

    // Watermark on all pages
    addPdfWatermark(doc);

    const pdfBlob = doc.output('blob');
    await downloadFile(pdfBlob, `BNG_${reportType}_report_${year}.pdf`, 'application/pdf');
    toast({ title: 'PDF downloaded successfully!', description: `BNG_${reportType}_report_${year}.pdf` });
    } catch (error) {
      toast({ title: 'PDF Download failed', description: error.message, variant: 'destructive' });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadPPT = async () => {
    setPptLoading(true);
    try {
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
    const qrDataUrl = await getQrDataUrl('https://wa.me/919652953160', 200);

    const addPptWatermark = (slide) => {
      slide.addText('BNG', {
        x: 2.5, y: 2.2, w: 8, h: 1.5,
        fontSize: 60, bold: true, color: '94A3B8',
        align: 'center', valign: 'middle',
        transparency: 85,
        rotate: 35,
      });
    };

    // Slide 1 — Title
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: DARK };
    addPptWatermark(titleSlide);
    titleSlide.addText('BNG Financial Maintenance', { x: 0.5, y: 1.8, w: 12, h: 1, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri' });
    const reportLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
    titleSlide.addText(`${reportLabel} Financial Report`, { x: 0.5, y: 2.8, w: 12, h: 0.6, fontSize: 24, color: GREEN, align: 'center' });
    titleSlide.addText(`${reportType === 'annual' ? `Year ${year}` : `${MONTHS[Number(selectedMonth) - 1]} ${year}`}`, { x: 0.5, y: 3.4, w: 12, h: 0.5, fontSize: 18, color: 'CBD5E1', align: 'center' });
    titleSlide.addText(`Generated: ${new Date().toLocaleDateString('en-IN')}`, { x: 0.5, y: 4.2, w: 12, h: 0.4, fontSize: 12, color: '94A3B8', align: 'center' });

    // Slide 2 — Summary
    const summarySlide = pptx.addSlide();
    summarySlide.background = { color: 'FFFFFF' };
    addPptWatermark(summarySlide);
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
    addPptWatermark(allocSlide);
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
      addPptWatermark(monthlySlide);
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
      addPptWatermark(expSlide);
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
    addPptWatermark(footerSlide);
    footerSlide.addText('Six-Point Financial Allocation Method', { x: 0.5, y: 0.8, w: 12, h: 0.6, fontSize: 24, bold: true, color: DARK, align: 'center' });
    const methodText = [
      { text: '50% Home Needs  •  15% Emergency Fund  •  10% Investment\n', options: { fontSize: 16, color: DARK, align: 'center', breakLine: true } },
      { text: '10% Learning  •  10% Luxury  •  5% Charity', options: { fontSize: 16, color: DARK, align: 'center' } },
    ];
    footerSlide.addText(methodText, { x: 0.5, y: 1.8, w: 12, h: 1.2 });
    footerSlide.addText('Earn Smart. Spend Smart. Save Smart. Build Wealth.', { x: 0.5, y: 3.5, w: 12, h: 0.5, fontSize: 14, color: GREEN, italic: true, align: 'center' });
    if (qrDataUrl) {
      footerSlide.addImage({ data: qrDataUrl, x: 6.0, y: 4.2, w: 1.3, h: 1.3 });
      footerSlide.addText('Scan for WhatsApp: 9652953160', { x: 5.0, y: 5.55, w: 3.3, h: 0.3, fontSize: 11, color: MUTED, align: 'center' });
    }

    const pptxBlob = await pptx.write({ outputType: 'blob' });
    await downloadFile(pptxBlob, `BNG_${reportType}_report_${year}.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    toast({ title: 'PPT downloaded successfully!', description: `BNG_${reportType}_report_${year}.pptx` });
    } catch (error) {
      toast({ title: 'PPT Download failed', description: error.message, variant: 'destructive' });
    } finally {
      setPptLoading(false);
    }
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
          <Button onClick={handleDownload} disabled={pdfLoading} variant="outline" className="gap-2">
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {pdfLoading ? 'Generating...' : 'Download PDF'}
          </Button>
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
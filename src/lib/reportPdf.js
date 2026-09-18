import jsPDF from 'jspdf';
import { MONTHS, CATEGORIES, formatCurrency } from '@/lib/constants';

export const downloadFile = async (blob, filename, mime) => {
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
  }
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
  }, 5000);
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

const addPdfWatermark = (doc) => {
  try {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.saveGraphicsState();
      if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.08 }));
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(72);
      doc.setFont('helvetica', 'bold');
      doc.text('BNG', 105, 160, { align: 'center', angle: 45 });
      doc.restoreGraphicsState();
    }
  } catch (e) { /* optional */ }
};

const sumField = (arr, key) => arr.reduce((s, i) => s + (i[key] || 0), 0);

/**
 * Generates and downloads the BNG financial report PDF.
 * @param {{reportType:'monthly'|'quarterly'|'annual', month:number, year:number, yearIncomes:array, yearExpenses:array, score:number, healthLabel:string}} opts
 */
export async function generateReportPdf({ reportType, month, year, yearIncomes, yearExpenses, score, healthLabel }) {
  const doc = new jsPDF();
  const qrDataUrl = await getQrDataUrl('https://wa.me/919652953160', 150);
  const pageWidth = 210;
  const margin = 20;
  let y = 20;

  const monthIncome = yearIncomes.find(i => i.month === month);
  const monthExp = yearExpenses.filter(e => new Date(e.date).getMonth() + 1 === month);
  const monthTotalExp = sumField(monthExp, 'amount');

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BNG Financial Maintenance', margin, 16);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const reportLabel = reportType.charAt(0).toUpperCase() + reportType.slice(1);
  doc.text(`${reportLabel} Financial Report${reportType === 'monthly' ? ` - ${MONTHS[month - 1]} ${year}` : ` - ${year}`}`, margin, 24);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, 24, { align: 'right' });

  y = 44;
  doc.setTextColor(30, 41, 59);

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

  addSectionTitle('Financial Summary');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const isAnnual = reportType === 'annual';
  const totalIncome = isAnnual ? sumField(yearIncomes, 'income') : (monthIncome?.income || 0);
  const totalExp = isAnnual ? sumField(yearExpenses, 'amount') : monthTotalExp;
  doc.text(`Total Income:    ${formatCurrency(totalIncome)}`, margin, y); y += 7;
  doc.text(`Total Expenses:  ${formatCurrency(totalExp)}`, margin, y); y += 7;
  doc.text(`Net Savings:     ${formatCurrency(totalIncome - totalExp)}`, margin, y); y += 7;
  doc.text(`Health Score:    ${score}/100 (${healthLabel})`, margin, y); y += 12;

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

  const allocIncome = isAnnual
    ? Object.fromEntries(CATEGORIES.map(c => [c.key, sumField(yearIncomes, c.key)]))
    : (monthIncome || {});
  const allocExpenses = isAnnual ? yearExpenses : monthExp;

  CATEGORIES.forEach(cat => {
    if (y > 270) { doc.addPage(); y = 20; }
    const allocated = allocIncome[cat.key] || 0;
    const spent = sumField(allocExpenses.filter(e => e.category === cat.key), 'amount');
    doc.text(cat.label, margin, y);
    doc.text(`${cat.percentage}%`, 80, y);
    doc.text(formatCurrency(allocated), 100, y);
    doc.text(formatCurrency(spent), 135, y);
    doc.text(formatCurrency(allocated - spent), 165, y);
    y += 7;
  });
  y += 8;

  if (isAnnual) {
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
      const me = sumField(yearExpenses.filter(e => new Date(e.date).getMonth() + 1 === idx + 1), 'amount');
      const income = mi?.income || 0;
      doc.text(m, margin, y);
      doc.text(formatCurrency(income), 80, y);
      doc.text(formatCurrency(me), 120, y);
      doc.text(formatCurrency(income - me), 160, y);
      y += 6;
    });
  } else {
    addSectionTitle('Expense Details');
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

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 42, y - 28, 25, 25);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Scan for WhatsApp', pageWidth - 29.5, y + 2, { align: 'center' });
  }

  addPdfWatermark(doc);

  const filename = reportType === 'monthly'
    ? `BNG_${MONTHS[month - 1]}_${year}_report.pdf`
    : `BNG_${reportType}_report_${year}.pdf`;
  await downloadFile(doc.output('blob'), filename, 'application/pdf');
  return filename;
}
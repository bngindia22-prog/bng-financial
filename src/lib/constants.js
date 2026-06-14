export const CATEGORIES = [
  { key: 'home_needs', label: 'Home Needs', percentage: 50, color: '#10b981', icon: 'Home' },
  { key: 'emergency_fund', label: 'Emergency Fund', percentage: 15, color: '#3b82f6', icon: 'Shield' },
  { key: 'investment', label: 'Investment', percentage: 10, color: '#8b5cf6', icon: 'TrendingUp' },
  { key: 'learning', label: 'Learning', percentage: 10, color: '#f59e0b', icon: 'GraduationCap' },
  { key: 'luxury', label: 'Luxury', percentage: 10, color: '#ec4899', icon: 'Sparkles' },
  { key: 'charity', label: 'Charity', percentage: 5, color: '#06b6d4', icon: 'Heart' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

export function allocateIncome(income) {
  return {
    home_needs: Math.round(income * 0.50),
    emergency_fund: Math.round(income * 0.15),
    investment: Math.round(income * 0.10),
    learning: Math.round(income * 0.10),
    luxury: Math.round(income * 0.10),
    charity: Math.round(income * 0.05),
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function getCategoryColor(key) {
  return CATEGORIES.find(c => c.key === key)?.color || '#6b7280';
}

export function getCategoryLabel(key) {
  return CATEGORIES.find(c => c.key === key)?.label || key;
}

export function calculateHealthScore(monthlyIncomes, expenses) {
  if (!monthlyIncomes || monthlyIncomes.length === 0) return 0;
  
  let score = 0;
  const totalMonths = monthlyIncomes.length;
  
  // Emergency fund maintained (25 points)
  const emergencyMonths = monthlyIncomes.filter(m => m.emergency_fund > 0).length;
  score += (emergencyMonths / totalMonths) * 25;
  
  // Investment consistency (25 points)
  const investmentMonths = monthlyIncomes.filter(m => m.investment > 0).length;
  score += (investmentMonths / totalMonths) * 25;
  
  // Savings percentage (25 points)
  const totalIncome = monthlyIncomes.reduce((sum, m) => sum + (m.income || 0), 0);
  const totalExpenses = expenses ? expenses.reduce((sum, e) => sum + (e.amount || 0), 0) : 0;
  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;
  score += Math.min(savingsRate * 100, 25);
  
  // Budget discipline (25 points)
  const charityMonths = monthlyIncomes.filter(m => m.charity > 0).length;
  score += (charityMonths / totalMonths) * 25;
  
  return Math.round(Math.min(score, 100));
}

export function getHealthLabel(score) {
  if (score >= 90) return { label: 'Excellent', color: 'text-emerald-600' };
  if (score >= 75) return { label: 'Good', color: 'text-blue-600' };
  if (score >= 60) return { label: 'Average', color: 'text-amber-600' };
  return { label: 'Poor', color: 'text-red-600' };
}
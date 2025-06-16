import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';
    
    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    // Get all transactions in the period
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        }
      },
      include: {
        bankAccount: true
      }
    });
    
    // Calculate summary
    const summary = {
      totalTransactions: transactions.length,
      totalIncome: transactions
        .filter(tx => tx.type === 'RECEIVE')
        .reduce((sum, tx) => sum + tx.amount?.toNumber() || 0, 0),
      totalExpenses: Math.abs(transactions
        .filter(tx => tx.type === 'SPEND')
        .reduce((sum, tx) => sum + tx.amount?.toNumber() || 0, 0)),
      netAmount: 0,
      periodStart: startDate.toISOString(),
      periodEnd: now.toISOString()
    };
    
    summary.netAmount = summary.totalIncome - summary.totalExpenses;
    
    // Group by account
    const accountMap = new Map();
    transactions.forEach(tx => {
      const key = tx.bankAccount.name;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          account: tx.bankAccount.name,
          currency: tx.bankAccount.currencyCode || 'GBP',
          transactionCount: 0,
          totalAmount: 0
        });
      }
      const acc = accountMap.get(key);
      acc.transactionCount++;
      acc.totalAmount += tx.type === 'RECEIVE' ? (tx.amount?.toNumber() || 0) : -(tx.amount?.toNumber() || 0);
    });
    
    const byAccount = Array.from(accountMap.values())
      .sort((a, b) => b.transactionCount - a.transactionCount);
    
    // Group by month
    const monthMap = new Map();
    transactions.forEach(tx => {
      const monthKey = new Date(tx.date).toISOString().slice(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          income: 0,
          expenses: 0,
          net: 0,
          transactionCount: 0
        });
      }
      const month = monthMap.get(monthKey);
      month.transactionCount++;
      if (tx.type === 'RECEIVE') {
        month.income += tx.amount?.toNumber() || 0;
      } else {
        month.expenses += tx.amount?.toNumber() || 0;
      }
      month.net = month.income - Math.abs(month.expenses);
    });
    
    const byMonth = Array.from(monthMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }));
    
    // Group by category (using description patterns)
    const categoryMap = new Map();
    const categoryPatterns = {
      'Sales': ['sales', 'revenue', 'invoice'],
      'Purchases': ['purchase', 'supplier', 'vendor'],
      'Payroll': ['salary', 'payroll', 'wages'],
      'Tax': ['tax', 'vat', 'hmrc'],
      'Banking': ['bank', 'transfer', 'fee'],
      'Other': []
    };
    
    transactions.forEach(tx => {
      let category = 'Other';
      const desc = (tx.description || '').toLowerCase();
      
      for (const [cat, patterns] of Object.entries(categoryPatterns)) {
        if (patterns.some(p => desc.includes(p))) {
          category = cat;
          break;
        }
      }
      
      if (!categoryMap.has(category)) {
        categoryMap.set(category, 0);
      }
      categoryMap.set(category, categoryMap.get(category) + Math.abs(tx.amount?.toNumber() || 0));
    });
    
    const totalCategoryAmount = Array.from(categoryMap.values()).reduce((a, b) => a + b, 0);
    const byCategory = Array.from(categoryMap.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalCategoryAmount) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Calculate trends
    const previousPeriodStart = new Date(startDate);
    previousPeriodStart.setMonth(previousPeriodStart.getMonth() - (period === 'month' ? 1 : period === 'quarter' ? 3 : 12));
    
    const previousTransactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: previousPeriodStart,
          lt: startDate
        }
      }
    });
    
    const prevIncome = previousTransactions
      .filter(tx => tx.type === 'RECEIVE')
      .reduce((sum, tx) => sum + tx.amount?.toNumber() || 0, 0);
    const prevExpenses = Math.abs(previousTransactions
      .filter(tx => tx.type === 'SPEND')
      .reduce((sum, tx) => sum + tx.amount?.toNumber() || 0, 0));
    
    const trends = {
      incomeGrowth: prevIncome > 0 ? ((summary.totalIncome - prevIncome) / prevIncome) * 100 : 0,
      expenseGrowth: prevExpenses > 0 ? ((summary.totalExpenses - prevExpenses) / prevExpenses) * 100 : 0,
      topExpenseCategory: byCategory.find(c => c.category !== 'Sales')?.category || 'N/A',
      topIncomeSource: byCategory.find(c => c.category === 'Sales')?.category || 'Sales'
    };
    
    return NextResponse.json({
      summary,
      byAccount,
      byMonth,
      byCategory,
      trends
    });
    
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    );
  }
}
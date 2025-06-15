import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Query transactions with account codes
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        },
        type: 'SPEND',
        status: {
          not: 'DELETED'
        },
        accountCode: {
          not: null
        }
      }
    });

    // Get GL accounts for mapping
    const glAccounts = await prisma.gLAccount.findMany({
      where: {
        status: 'ACTIVE'
      }
    });

    // Create category mapping based on account codes
    const categoryMap = new Map<string, string>();
    
    // Define category rules based on account codes and types
    glAccounts.forEach(account => {
      const code = parseInt(account.code);
      let category = 'Other';
      
      // Based on common Xero account code ranges
      if (code >= 200 && code < 300) {
        category = 'Operations'; // Current Assets
      } else if (code >= 300 && code < 400) {
        category = 'Fixed Assets';
      } else if (code >= 400 && code < 500) {
        category = 'Operations'; // Direct Costs
      } else if (code >= 500 && code < 600) {
        category = 'Operations'; // Overhead
      } else if (code >= 600 && code < 700) {
        category = 'Marketing'; // Marketing/Sales
      } else if (code >= 700 && code < 800) {
        category = 'Professional Services'; // Professional fees
      } else if (code >= 460 && code < 470) {
        category = 'Software & Tools'; // IT/Software
      }
      
      // Override based on account name patterns
      const nameLower = account.name.toLowerCase();
      if (nameLower.includes('software') || nameLower.includes('subscription') || nameLower.includes('computer')) {
        category = 'Software & Tools';
      } else if (nameLower.includes('marketing') || nameLower.includes('advertising') || nameLower.includes('promotion')) {
        category = 'Marketing';
      } else if (nameLower.includes('professional') || nameLower.includes('consulting') || nameLower.includes('legal') || nameLower.includes('accounting')) {
        category = 'Professional Services';
      } else if (nameLower.includes('rent') || nameLower.includes('utilities') || nameLower.includes('office')) {
        category = 'Operations';
      } else if (nameLower.includes('travel') || nameLower.includes('entertainment') || nameLower.includes('meals')) {
        category = 'Travel & Entertainment';
      }
      
      categoryMap.set(account.code, category);
    });

    // Group transactions by category
    const categoryTotals = new Map<string, number>();
    let totalSpend = 0;
    
    transactions.forEach(tx => {
      const category = tx.accountCode ? (categoryMap.get(tx.accountCode) || 'Other') : 'Other';
      const amount = Math.abs(tx.amount);
      
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
      totalSpend += amount;
    });

    // Convert to array and calculate percentages
    const categories = Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpend > 0 ? parseFloat(((amount / totalSpend) * 100).toFixed(1)) : 0,
        transactionCount: transactions.filter(tx => {
          const cat = tx.accountCode ? (categoryMap.get(tx.accountCode) || 'Other') : 'Other';
          return cat === category;
        }).length
      }))
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json({
      success: true,
      categories,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalSpend,
      summary: {
        topCategory: categories[0]?.category || 'N/A',
        topCategoryPercentage: categories[0]?.percentage || 0,
        categoryCount: categories.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching category breakdown:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch category breakdown',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
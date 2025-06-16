import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { analyticsPeriodSchema } from '@/lib/validation/schemas';
import { memoryMonitor } from '@/lib/memory-monitor';

export const GET = withValidation(
  { querySchema: analyticsPeriodSchema },
  async (request, { query }) => {
    return memoryMonitor.monitorOperation('analytics-category-breakdown', async () => {
      try {
      const period = query?.period || '30d';
    
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

    // Get page and pageSize from query parameters
    const page = parseInt((request.nextUrl.searchParams.get('page') || '1'));
    const pageSize = parseInt((request.nextUrl.searchParams.get('pageSize') || '1000'));
    const skip = (page - 1) * pageSize;
    
    // Query transactions with account codes and get total count
    const [transactions, totalTransactions] = await Promise.all([
      prisma.bankTransaction.findMany({
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
        },
        skip,
        take: pageSize
      }),
      prisma.bankTransaction.count({
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
      })
    ]);

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
      const amount = tx.amount ? Math.abs(tx.amount.toNumber()) : 0;
      
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

      const totalPages = Math.ceil(totalTransactions / pageSize);
      
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
        },
        pagination: {
          page,
          pageSize,
          totalTransactions,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
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
    });
  }
)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { analyticsPeriodSchema } from '@/lib/validation/schemas';

export const GET = withValidation(
  { querySchema: analyticsPeriodSchema },
  async (request, { query }) => {
    try {
      const period = query?.period || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    let groupBy: 'day' | 'week' | 'month' = 'day';
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        groupBy = 'day';
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        groupBy = 'week';
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        groupBy = 'month';
        break;
      default:
        startDate.setDate(now.getDate() - 30);
        groupBy = 'day';
    }

    // Query transactions grouped by date
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        },
        type: 'SPEND',
        status: {
          not: 'DELETED'
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    // Group transactions by date period
    const trendMap = new Map<string, number>();
    
    transactions.forEach(tx => {
      let dateKey: string;
      const txDate = new Date(tx.date);
      
      if (groupBy === 'day') {
        dateKey = txDate.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        // Get start of week
        const weekStart = new Date(txDate);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        dateKey = weekStart.toISOString().split('T')[0];
      } else {
        // Month
        dateKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-01`;
      }
      
      const currentAmount = trendMap.get(dateKey) || 0;
      trendMap.set(dateKey, currentAmount + Math.abs(tx.amount.toNumber()));
    });

    // Fill in missing dates
    const trend: { date: string; amount: number }[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= now) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      if (groupBy === 'day') {
        trend.push({
          date: dateKey,
          amount: trendMap.get(dateKey) || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
      } else if (groupBy === 'week') {
        // Start of week
        const weekStart = new Date(currentDate);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!trend.find(t => t.date === weekKey)) {
          trend.push({
            date: weekKey,
            amount: trendMap.get(weekKey) || 0
          });
        }
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        // Month
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
        if (!trend.find(t => t.date === monthKey)) {
          trend.push({
            date: monthKey,
            amount: trendMap.get(monthKey) || 0
          });
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

      return NextResponse.json({
        success: true,
        trend,
        period,
        groupBy,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      });

    } catch (error: any) {
      console.error('Error fetching spend trend:', error);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch spend trend',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
)
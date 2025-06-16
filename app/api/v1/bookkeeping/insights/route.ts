import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get unreconciled transactions count by age
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    // Batch all queries for better performance
    const [
      totalUnreconciled, 
      oldUnreconciled, 
      veryOldUnreconciled,
      recentPayments,
      oldestUnreconciled
    ] = await Promise.all([
      prisma.bankTransaction.count({
        where: { isReconciled: false }
      }),
      prisma.bankTransaction.count({
        where: {
          isReconciled: false,
          date: { lt: thirtyDaysAgo }
        }
      }),
      prisma.bankTransaction.count({
        where: {
          isReconciled: false,
          date: { lt: sixtyDaysAgo }
        }
      }),
      // Get recent spend transactions that might be payments
      prisma.bankTransaction.count({
        where: {
          type: 'SPEND',
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7))
          }
        }
      }),
      // Get oldest unreconciled transaction
      prisma.bankTransaction.findFirst({
        where: { isReconciled: false },
        orderBy: { date: 'asc' },
        select: { date: true }
      })
    ]);
    
    return NextResponse.json({
      unreconciled: {
        total: totalUnreconciled,
        overThirtyDays: oldUnreconciled,
        overSixtyDays: veryOldUnreconciled,
        oldest: oldestUnreconciled?.date || null
      },
      recentActivity: {
        paymentsLastWeek: recentPayments
      }
    });
    
  } catch (error: any) {
    console.error('Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
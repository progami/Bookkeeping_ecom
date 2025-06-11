import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const [accountCount, transactionCount, lastSync] = await Promise.all([
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.syncLog.findFirst({
        orderBy: { startedAt: 'desc' }
      })
    ]);
    
    const unreconciledCount = await prisma.bankTransaction.count({
      where: { isReconciled: false }
    });
    
    const accountBreakdown = await prisma.bankAccount.findMany({
      select: {
        name: true,
        currencyCode: true,
        _count: {
          select: { transactions: true }
        }
      }
    });
    
    return NextResponse.json({
      summary: {
        totalAccounts: accountCount,
        totalTransactions: transactionCount,
        unreconciledTransactions: unreconciledCount,
        lastSync: lastSync
      },
      accounts: accountBreakdown.map(acc => ({
        name: acc.name,
        currency: acc.currencyCode,
        transactionCount: acc._count.transactions
      }))
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error.message
    }, { status: 500 });
  }
}
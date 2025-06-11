import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get bank accounts from database
    const dbAccounts = await prisma.bankAccount.findMany({
      include: {
        _count: {
          select: {
            transactions: {
              where: {
                isReconciled: false,
                status: { not: 'DELETED' }
              }
            }
          }
        }
      }
    });

    // Get total unreconciled count
    const totalUnreconciled = await prisma.bankTransaction.count({
      where: {
        isReconciled: false,
        status: { not: 'DELETED' }
      }
    });

    // Calculate reconciliation rate
    const totalTransactions = await prisma.bankTransaction.count({
      where: {
        status: { not: 'DELETED' }
      }
    });
    const reconciledTransactions = await prisma.bankTransaction.count({
      where: {
        isReconciled: true,
        status: { not: 'DELETED' }
      }
    });
    const reconciliationRate = totalTransactions > 0 
      ? Math.round((reconciledTransactions / totalTransactions) * 100)
      : 100;

    // Transform accounts data
    const accounts = await Promise.all(dbAccounts.map(async (account) => {
      // Calculate balance from transactions
      const transactions = await prisma.bankTransaction.findMany({
        where: {
          bankAccountId: account.id,
          status: { not: 'DELETED' }
        }
      });
      
      let balance = 0;
      transactions.forEach(tx => {
        if (tx.type === 'RECEIVE') {
          balance += tx.amount;
        } else {
          balance -= tx.amount;
        }
      });

      return {
        id: account.id,
        xeroAccountId: account.xeroAccountId,
        name: account.name,
        code: account.code,
        currencyCode: account.currencyCode || 'GBP',
        balance: balance,
        status: account.status,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        unreconciledTransactions: account._count.transactions,
        lastSynced: account.updatedAt
      };
    }));

    return NextResponse.json({
      accounts,
      totalUnreconciled,
      reconciliationRate,
      needsAttention: accounts.filter(acc => acc.unreconciledTransactions > 10).length,
      oldestUnreconciled: await prisma.bankTransaction.findFirst({
        where: { 
          isReconciled: false,
          status: { not: 'DELETED' }
        },
        orderBy: { date: 'asc' },
        select: { date: true }
      })?.then(tx => tx?.date || null)
    });
    
  } catch (error: any) {
    console.error('Bank accounts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}
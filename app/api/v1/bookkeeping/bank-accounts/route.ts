import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Batch all queries using Promise.all for better performance
    const [
      dbAccounts,
      totalUnreconciled,
      totalTransactions,
      reconciledTransactions,
      oldestUnreconciledTx
    ] = await Promise.all([
      // Get bank accounts from database
      prisma.bankAccount.findMany({
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
      }),
      // Get total unreconciled count
      prisma.bankTransaction.count({
        where: {
          isReconciled: false,
          status: { not: 'DELETED' }
        }
      }),
      // Get total transactions
      prisma.bankTransaction.count({
        where: {
          status: { not: 'DELETED' }
        }
      }),
      // Get reconciled transactions
      prisma.bankTransaction.count({
        where: {
          isReconciled: true,
          status: { not: 'DELETED' }
        }
      }),
      // Get oldest unreconciled transaction
      prisma.bankTransaction.findFirst({
        where: { 
          isReconciled: false,
          status: { not: 'DELETED' }
        },
        orderBy: { date: 'asc' },
        select: { date: true }
      })
    ]);
    const reconciliationRate = totalTransactions > 0 
      ? Math.round((reconciledTransactions / totalTransactions) * 100)
      : 100;

    // Transform accounts data
    const accounts = dbAccounts.map(account => ({
      id: account.id,
      xeroAccountId: account.xeroAccountId,
      name: account.name,
      code: account.code,
      currencyCode: account.currencyCode || 'GBP',
      balance: account.balance || 0, // Use stored balance
      status: account.status,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      unreconciledTransactions: account._count.transactions,
      lastSynced: account.balanceLastUpdated || account.updatedAt
    }));

    // NOTE: Xero Accounts API does not provide balance information
    // Balances must be synced separately using Reports API (Balance Sheet)
    // The balance stored in the database is from the last sync

    return NextResponse.json({
      accounts,
      totalUnreconciled,
      reconciliationRate,
      needsAttention: accounts.filter(acc => acc.unreconciledTransactions > 10).length,
      oldestUnreconciled: oldestUnreconciledTx?.date || null
    });
    
  } catch (error: any) {
    console.error('Bank accounts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}
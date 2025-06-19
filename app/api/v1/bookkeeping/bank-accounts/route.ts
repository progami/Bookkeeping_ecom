import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('[Bank Accounts API] Fetching bank accounts with dynamic balance calculation');
    
    // Batch all queries using Promise.all for better performance
    const [
      dbAccounts,
      totalUnreconciled,
      totalTransactions,
      reconciledTransactions,
      oldestUnreconciledTx,
      transactionBalances
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
      }),
      // Calculate balances dynamically from transactions
      prisma.bankTransaction.groupBy({
        by: ['bankAccountId', 'type'],
        where: {
          status: { not: 'DELETED' }
        },
        _sum: {
          total: true
        }
      })
    ]);
    const reconciliationRate = totalTransactions > 0 
      ? Math.round((reconciledTransactions / totalTransactions) * 100)
      : 100;

    // Create a map of calculated balances from transactions
    const balanceMap = new Map<string, number>();
    
    // Process transaction balances
    transactionBalances.forEach(item => {
      const currentBalance = balanceMap.get(item.bankAccountId) || 0;
      const amount = Number(item._sum.total || 0);
      
      // RECEIVE transactions are positive, SPEND transactions are negative
      if (item.type === 'RECEIVE') {
        balanceMap.set(item.bankAccountId, currentBalance + amount);
      } else if (item.type === 'SPEND') {
        balanceMap.set(item.bankAccountId, currentBalance - amount);
      }
    });

    console.log('[Bank Accounts API] Calculated balances:', Object.fromEntries(balanceMap));

    // Transform accounts data with calculated balances
    const accounts = dbAccounts.map(account => {
      const calculatedBalance = balanceMap.get(account.id) || 0;
      console.log(`[Bank Accounts API] Account ${account.name}: stored balance = ${account.balance}, calculated balance = ${calculatedBalance}`);
      
      return {
        id: account.id,
        xeroAccountId: account.xeroAccountId,
        name: account.name,
        code: account.code,
        currencyCode: account.currencyCode || 'GBP',
        balance: calculatedBalance, // Use dynamically calculated balance
        status: account.status,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        unreconciledTransactions: account._count.transactions,
        lastSynced: account.balanceLastUpdated || account.updatedAt
      };
    });

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
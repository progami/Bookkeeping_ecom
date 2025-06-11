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

    // Try to get actual balances from Xero
    try {
      const { getXeroClient } = await import('@/lib/xero-client');
      const xero = await getXeroClient();
      
      if (xero) {
        await xero.updateTenants();
        const tenant = xero.tenants[0];
        
        // Get bank accounts from Xero with current balances
        const xeroResponse = await xero.accountingApi.getAccounts(
          tenant.tenantId,
          undefined,
          'Type=="BANK"',
          undefined,
          undefined
        );
        
        if (xeroResponse.body.accounts) {
          // Update balances from Xero
          for (const account of accounts) {
            const xeroAccount = xeroResponse.body.accounts.find(
              xa => xa.accountID === account.xeroAccountId
            );
            
            if (xeroAccount) {
              // Xero provides balance in the account object
              account.balance = xeroAccount.balance || 0;
            }
          }
        }
      }
    } catch (error) {
      console.error('Could not fetch Xero balances:', error);
      // Continue with zero balances if Xero is not connected
    }

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
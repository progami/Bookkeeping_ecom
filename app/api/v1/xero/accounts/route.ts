import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';
import { RowType } from 'xero-node';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json(
        { error: 'Not connected to Xero' },
        { status: 401 }
      );
    }

    if (!xero.tenants || xero.tenants.length === 0) {
      return NextResponse.json(
        { error: 'No Xero organization connected' },
        { status: 401 }
      );
    }

    const tenant = xero.tenants[0];
    
    // Get bank accounts from database
    const dbAccounts = await prisma.bankAccount.findMany({
      include: {
        _count: {
          select: {
            transactions: {
              where: {
                isReconciled: false
              }
            }
          }
        }
      }
    });

    // Get total unreconciled count
    const totalUnreconciled = await prisma.bankTransaction.count({
      where: {
        isReconciled: false
      }
    });

    // Transform accounts data
    const accounts = dbAccounts.map(account => ({
      id: account.id,
      xeroAccountId: account.xeroAccountId,
      name: account.name,
      code: account.code,
      currencyCode: account.currencyCode || 'GBP',
      balance: 0, // Will be fetched from Xero if needed
      status: account.status,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      unreconciledTransactions: account._count.transactions,
      lastSynced: account.updatedAt
    }));

    // If we have accounts, try to get current balances from Xero
    if (accounts.length > 0) {
      try {
        // First try to get balances from the accounts endpoint
        const xeroAccounts = await xero.accountingApi.getAccounts(
          tenant.tenantId, 
          undefined, 
          'Type=="BANK"'
        );
        
        // Update balances from Xero accounts
        if (xeroAccounts.body.accounts) {
          for (const acc of accounts) {
            const xeroAccount = xeroAccounts.body.accounts.find(
              xa => xa.accountID === acc.xeroAccountId
            );
            
            if (xeroAccount) {
              // Try different balance fields that Xero might use
              const balance = 
                (xeroAccount as any).currentBalance ||
                (xeroAccount as any).balance ||
                0;
              
              acc.balance = typeof balance === 'number' ? balance : parseFloat(balance) || 0;
              
              console.log(`Account ${acc.name}: balance = ${acc.balance}`);
            }
          }
        }
        
        // If balances are still zero, try the balance sheet report
        const hasZeroBalances = accounts.every(acc => acc.balance === 0);
        if (hasZeroBalances) {
          console.log('All balances are zero, trying balance sheet report...');
          
          try {
            const balanceSheet = await xero.accountingApi.getReportBalanceSheet(
              tenant.tenantId,
              undefined,
              3, // periods
              'MONTH', // timeframe
              undefined, // trackingOptions
              undefined // standardLayout
            );
            
            if (balanceSheet.body.reports && balanceSheet.body.reports[0]) {
              const report = balanceSheet.body.reports[0];
              
              // Find bank accounts section in the balance sheet
              for (const row of report.rows || []) {
                if ((row as any).rowType === RowType.Section && row.title?.includes('Bank')) {
                  // Process bank account rows
                  for (const accountRow of row.rows || []) {
                    if (accountRow.cells) {
                      const accountName = accountRow.cells[0]?.value;
                      const balanceValue = accountRow.cells[1]?.value;
                      
                      if (accountName && balanceValue) {
                        const matchingAccount = accounts.find(acc => 
                          acc.name.toLowerCase().includes(accountName.toString().toLowerCase())
                        );
                        
                        if (matchingAccount) {
                          matchingAccount.balance = parseFloat(balanceValue.toString()) || 0;
                          console.log(`Updated ${matchingAccount.name} balance from balance sheet: ${matchingAccount.balance}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error fetching balance sheet:', error);
          }
        }
        
        // As a last resort, calculate balance from transactions
        const stillHasZeroBalances = accounts.every(acc => acc.balance === 0);
        if (stillHasZeroBalances) {
          console.log('Still zero balances, calculating from transactions...');
          
          for (const account of accounts) {
            const transactions = await prisma.bankTransaction.findMany({
              where: {
                bankAccountId: account.id
              },
              orderBy: {
                date: 'desc'
              }
            });
            
            // Calculate running balance
            let calculatedBalance = 0;
            for (const tx of transactions) {
              if (tx.type === 'RECEIVE') {
                calculatedBalance += tx.amount;
              } else {
                calculatedBalance -= tx.amount;
              }
            }
            
            account.balance = calculatedBalance;
            console.log(`Calculated balance for ${account.name}: ${calculatedBalance}`);
          }
        }
      } catch (error) {
        console.error('Error fetching Xero account balances:', error);
      }
    }

    // Calculate reconciliation rate
    const totalTransactions = await prisma.bankTransaction.count();
    const reconciledTransactions = await prisma.bankTransaction.count({
      where: {
        isReconciled: true
      }
    });
    const reconciliationRate = totalTransactions > 0 
      ? Math.round((reconciledTransactions / totalTransactions) * 100)
      : 100;

    return NextResponse.json({
      accounts,
      totalUnreconciled,
      reconciliationRate,
      needsAttention: accounts.filter(acc => acc.unreconciledTransactions > 10).length,
      oldestUnreconciled: await prisma.bankTransaction.findFirst({
        where: { isReconciled: false },
        orderBy: { date: 'asc' },
        select: { date: true }
      })?.then(tx => tx?.date || null)
    });
    
  } catch (error: any) {
    console.error('Accounts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
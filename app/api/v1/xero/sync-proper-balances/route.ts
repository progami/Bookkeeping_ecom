import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';

export async function POST(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Syncing proper bank account balances from Xero...');
    
    // Method 1: Try balance sheet report to get actual bank balances
    try {
      const balanceSheet = await xero.accountingApi.getReportBalanceSheet(
        tenant.tenantId,
        new Date().toISOString().split('T')[0]
      );
      
      const accounts = [];
      
      if (balanceSheet.body.reports && balanceSheet.body.reports[0]) {
        const report = balanceSheet.body.reports[0];
        
        // Find the bank accounts section
        for (const row of report.rows || []) {
          if (row.rowType?.toString() === 'Section' && row.title?.toLowerCase().includes('bank')) {
            // Process bank account rows
            for (const accountRow of row.rows || []) {
              if (accountRow.cells && accountRow.cells.length >= 2) {
                const accountName = accountRow.cells[0]?.value?.toString();
                const balanceValue = accountRow.cells[1]?.value?.toString();
                
                if (accountName && balanceValue) {
                  const balance = parseFloat(balanceValue) || 0;
                  
                  // Find or create the bank account in our database
                  const dbAccount = await prisma.bankAccount.findFirst({
                    where: {
                      name: {
                        contains: accountName
                      }
                    }
                  });
                  
                  if (dbAccount) {
                    await prisma.bankAccount.update({
                      where: { id: dbAccount.id },
                      data: {
                        balance: balance,
                        balanceLastUpdated: new Date()
                      }
                    });
                    
                    accounts.push({
                      id: dbAccount.id,
                      name: accountName,
                      balance: balance,
                      currency: dbAccount.currencyCode || 'GBP',
                      status: 'updated'
                    });
                  }
                }
              }
            }
          }
        }
      }
      
      // Method 2: If no balances found, try the bank summary report
      if (accounts.length === 0) {
        console.log('No balances from balance sheet, trying bank summary...');
        
        try {
          const bankSummary = await xero.accountingApi.getReportBankSummary(
            tenant.tenantId,
            undefined, // from date
            undefined  // to date
          );
          
          if (bankSummary.body.reports && bankSummary.body.reports[0]) {
            const report = bankSummary.body.reports[0];
            
            for (const row of report.rows || []) {
              if (row.cells && row.cells.length >= 2) {
                const accountName = row.cells[0]?.value?.toString();
                const closingBalance = row.cells[row.cells.length - 1]?.value?.toString();
                
                if (accountName && closingBalance) {
                  const balance = parseFloat(closingBalance) || 0;
                  
                  const dbAccount = await prisma.bankAccount.findFirst({
                    where: {
                      name: {
                        contains: accountName
                      }
                    }
                  });
                  
                  if (dbAccount) {
                    await prisma.bankAccount.update({
                      where: { id: dbAccount.id },
                      data: {
                        balance: balance,
                        balanceLastUpdated: new Date()
                      }
                    });
                    
                    accounts.push({
                      id: dbAccount.id,
                      name: accountName,
                      balance: balance,
                      currency: dbAccount.currencyCode || 'GBP',
                      status: 'updated'
                    });
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Bank summary error:', error);
        }
      }
      
      // Method 3: Calculate from transactions if still no balances
      if (accounts.length === 0) {
        console.log('Calculating balances from transactions...');
        
        const bankAccounts = await prisma.bankAccount.findMany();
        
        for (const account of bankAccounts) {
          const transactions = await prisma.bankTransaction.findMany({
            where: {
              bankAccountId: account.id
            }
          });
          
          let balance = 0;
          for (const tx of transactions) {
            if (tx.type === 'RECEIVE') {
              balance += tx.amount;
            } else {
              balance -= tx.amount;
            }
          }
          
          await prisma.bankAccount.update({
            where: { id: account.id },
            data: {
              balance: balance,
              balanceLastUpdated: new Date()
            }
          });
          
          accounts.push({
            id: account.id,
            name: account.name,
            balance: balance,
            currency: account.currencyCode || 'GBP',
            status: 'calculated'
          });
        }
      }
      
      const totalCashInBank = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      
      return NextResponse.json({
        success: true,
        accounts: accounts,
        totalCashInBank: totalCashInBank,
        method: accounts[0]?.status === 'calculated' ? 'calculated_from_transactions' : 'from_xero_reports',
        timestamp: new Date().toISOString()
      });
      
    } catch (error: any) {
      console.error('Report fetch error:', error);
      
      // Fallback: Just return existing balances from database
      const bankAccounts = await prisma.bankAccount.findMany();
      const accounts = bankAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        balance: acc.balance,
        currency: acc.currencyCode || 'GBP',
        status: 'existing'
      }));
      
      return NextResponse.json({
        success: true,
        accounts: accounts,
        totalCashInBank: accounts.reduce((sum, acc) => sum + acc.balance, 0),
        method: 'from_database',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error: any) {
    console.error('Balance sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync balances',
      details: error.message
    }, { status: 500 });
  }
}
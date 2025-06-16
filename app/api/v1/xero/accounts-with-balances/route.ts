import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    console.log('=== Fetching Accounts with Balances ===');
    
    // Get Xero client
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      console.log('No Xero client available');
      return NextResponse.json(
        { error: 'Xero client not initialized' },
        { status: 503 }
      );
    }

    const { client: xero, tenantId } = xeroData;
    
    console.log('Fetching accounts from Xero...');
    
    try {
      // Fetch all accounts with their current balances
      // The Xero API can return account balances when requested
      const accountsResponse = await xero.accountingApi.getAccounts(
        tenantId,
        undefined, // If-Modified-Since
        undefined, // where
        'Code ASC' // order
      );

      const xeroAccounts = accountsResponse.body.accounts || [];
      console.log(`Found ${xeroAccounts.length} accounts in Xero`);

      // Get current date for YTD calculation
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

      // For each account, try to get its transactions for YTD calculation
      const accountsWithYTD: any[] = [];
      
      for (const account of xeroAccounts) {
        if (!account.accountID) continue;

        let ytdAmount = 0;

        try {
          // Try to get transactions for this account
          const transactionsResponse = await xero.accountingApi.getBankTransactions(
            tenantId,
            startOfYear, // If-Modified-Since
            `BankAccount.AccountID=Guid("${account.accountID}")`, // where
            undefined, // order
            1, // page
            100 // unitdp
          );

          // Sum up the transactions
          const transactions = transactionsResponse.body.bankTransactions || [];
          ytdAmount = transactions.reduce((sum, tx) => {
            return sum + (tx.total || 0);
          }, 0);
        } catch (txError) {
          // If bank transactions fail, try journal entries
          try {
            const journalsResponse = await xero.accountingApi.getJournals(
              tenantId,
              startOfYear, // If-Modified-Since
              undefined, // offset
              undefined, // paymentsOnly
            );

            const journals = journalsResponse.body.journals || [];
            
            // Sum journal lines for this account
            for (const journal of journals) {
              if (journal.journalLines) {
                for (const line of journal.journalLines) {
                  if (line.accountID === account.accountID) {
                    // Debit increases assets/expenses, credit increases liabilities/revenue
                    if (line.grossAmount) {
                      ytdAmount += line.grossAmount;
                    }
                  }
                }
              }
            }
          } catch (journalError) {
            console.log(`Could not get transactions for account ${account.code}`);
          }
        }

        // Get the account from our database to merge data
        const dbAccount = await prisma.gLAccount.findUnique({
          where: { code: account.code || '' }
        });

        if (dbAccount) {
          accountsWithYTD.push({
            ...dbAccount,
            ytdAmount: ytdAmount || 0,
            xeroBalance: account.hasAttachments ? 0 : ytdAmount // Fallback field
          });
        }
      }

      // Also check if we can get a Trial Balance report which has YTD balances
      try {
        const trialBalanceResponse = await xero.accountingApi.getReportTrialBalance(
          tenantId,
          currentDate.toISOString().split('T')[0], // date
          false // paymentsOnly
        );

        if (trialBalanceResponse.body.reports && trialBalanceResponse.body.reports.length > 0) {
          const report = trialBalanceResponse.body.reports[0];
          console.log('Trial Balance report found');
          
          // Parse trial balance for YTD amounts
          if (report.rows) {
            for (const section of report.rows) {
              if (section.rows) {
                for (const row of section.rows) {
                  if (row.cells && row.cells.length >= 3) {
                    // Trial balance typically has: Account, Debit, Credit
                    const accountCell = row.cells[0];
                    const debitCell = row.cells[1];
                    const creditCell = row.cells[2];
                    
                    // Find account code
                    if (accountCell.attributes) {
                      const accountAttr = accountCell.attributes.find((attr: any) => attr.id === 'account');
                      if (accountAttr && accountAttr.value) {
                        const accountCode = accountAttr.value;
                        
                        // Calculate net amount (debit - credit)
                        let amount = 0;
                        if (debitCell && debitCell.value) {
                          amount += parseFloat(debitCell.value.toString().replace(/[^0-9.-]/g, '')) || 0;
                        }
                        if (creditCell && creditCell.value) {
                          amount -= parseFloat(creditCell.value.toString().replace(/[^0-9.-]/g, '')) || 0;
                        }
                        
                        // Update the YTD amount for this account
                        const accountIndex = accountsWithYTD.findIndex(a => a.code === accountCode);
                        if (accountIndex >= 0) {
                          accountsWithYTD[accountIndex].ytdAmount = amount;
                          console.log(`Updated YTD from Trial Balance: ${accountCode} = ${amount}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (tbError) {
        console.log('Could not fetch Trial Balance:', tbError);
      }

      // Return the accounts with YTD data
      return NextResponse.json({
        success: true,
        accounts: {
          all: accountsWithYTD,
          byType: accountsWithYTD.reduce((acc, account) => {
            const type = account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(account);
            return acc;
          }, {} as Record<string, any[]>)
        },
        hasYTDData: accountsWithYTD.some(a => a.ytdAmount !== 0),
        summary: {
          totalAccounts: accountsWithYTD.length,
          accountsWithBalance: accountsWithYTD.filter(a => a.ytdAmount !== 0).length
        },
        period: {
          from: startOfYear.toISOString(),
          to: currentDate.toISOString()
        }
      });

    } catch (xeroError: any) {
      console.error('Xero API error:', xeroError);
      
      // If Xero fails, return accounts without YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      return NextResponse.json({
        success: false,
        accounts: {
          all: accounts,
          byType: accounts.reduce((acc, account) => {
            const type = account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(account);
            return acc;
          }, {} as Record<string, any[]>)
        },
        hasYTDData: false,
        error: 'Failed to fetch YTD data from Xero',
        message: xeroError.message
      });
    }

  } catch (error: any) {
    console.error('Error in accounts with balances endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch accounts with balances',
        message: error.message 
      },
      { status: 500 }
    );
  }
});
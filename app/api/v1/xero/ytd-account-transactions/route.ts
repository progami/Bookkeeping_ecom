import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { BankTransaction } from 'xero-node';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Fetching YTD from Account Transactions ===');
    
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
    
    // Get current year start date
    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    
    console.log(`Fetching transactions from ${startOfYear.toISOString().split('T')[0]} to now...`);
    
    try {
      // First get all accounts
      const accountsResponse = await xero.accountingApi.getAccounts(
        tenantId,
        undefined,
        undefined,
        'Code ASC'
      );
      
      const xeroAccounts = accountsResponse.body.accounts || [];
      console.log(`Found ${xeroAccounts.length} accounts in Xero`);
      
      // Initialize YTD balances
      const ytdBalances: Record<string, number> = {};
      const accountTypes: Record<string, string> = {};
      
      // Process accounts in batches to avoid rate limits
      const batchSize = 10;
      let processedAccounts = 0;
      
      for (let i = 0; i < xeroAccounts.length; i += batchSize) {
        const batch = xeroAccounts.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (account) => {
          if (!account.accountID || !account.code) return;
          
          accountTypes[account.code] = account.type?.toString() || '';
          
          try {
            // Get transactions for this account
            const whereFilter = `Account.AccountID=Guid("${account.accountID}") AND Date>=${startOfYear.toISOString().split('T')[0]}`;
            
            // Try bank transactions first
            try {
              const bankTxResponse = await xero.accountingApi.getBankTransactions(
                tenantId,
                undefined,
                whereFilter,
                'Date ASC',
                1,
                undefined
              );
              
              const bankTransactions = bankTxResponse.body.bankTransactions || [];
              
              for (const tx of bankTransactions) {
                if (tx.lineItems) {
                  for (const line of tx.lineItems) {
                    if (line.accountCode === account.code) {
                      const amount = line.lineAmount || 0;
                      if (!ytdBalances[account.code]) {
                        ytdBalances[account.code] = 0;
                      }
                      
                      // For bank transactions, use the line amount
                      if (tx.type === BankTransaction.TypeEnum.SPEND) {
                        ytdBalances[account.code] -= amount;
                      } else {
                        ytdBalances[account.code] += amount;
                      }
                    }
                  }
                }
              }
            } catch (bankError) {
              // Not a bank account, continue
            }
            
            // Get invoices
            try {
              const invWhereFilter = `Type=="ACCREC" AND Status!="DELETED" AND Status!="VOIDED" AND Date>=${startOfYear.toISOString().split('T')[0]}`;
              const invoicesResponse = await xero.accountingApi.getInvoices(
                tenantId,
                undefined,
                invWhereFilter,
                'Date ASC',
                undefined,
                undefined,
                undefined,
                undefined,
                1
              );
              
              const invoices = invoicesResponse.body.invoices || [];
              
              for (const invoice of invoices) {
                if (invoice.lineItems) {
                  for (const line of invoice.lineItems) {
                    if (line.accountCode === account.code) {
                      const amount = line.lineAmount || 0;
                      if (!ytdBalances[account.code]) {
                        ytdBalances[account.code] = 0;
                      }
                      ytdBalances[account.code] += amount;
                    }
                  }
                }
              }
            } catch (invError) {
              // Continue
            }
            
            // Get bills
            try {
              const billWhereFilter = `Type=="ACCPAY" AND Status!="DELETED" AND Status!="VOIDED" AND Date>=${startOfYear.toISOString().split('T')[0]}`;
              const billsResponse = await xero.accountingApi.getInvoices(
                tenantId,
                undefined,
                billWhereFilter,
                'Date ASC',
                undefined,
                undefined,
                undefined,
                undefined,
                1
              );
              
              const bills = billsResponse.body.invoices || [];
              
              for (const bill of bills) {
                if (bill.lineItems) {
                  for (const line of bill.lineItems) {
                    if (line.accountCode === account.code) {
                      const amount = line.lineAmount || 0;
                      if (!ytdBalances[account.code]) {
                        ytdBalances[account.code] = 0;
                      }
                      ytdBalances[account.code] -= amount; // Bills are expenses
                    }
                  }
                }
              }
            } catch (billError) {
              // Continue
            }
            
            // Get manual journals
            try {
              const journalsResponse = await xero.accountingApi.getManualJournals(
                tenantId,
                startOfYear,
                undefined,
                'Date ASC',
                1
              );
              
              const journals = journalsResponse.body.manualJournals || [];
              
              for (const journal of journals) {
                if (journal.journalLines) {
                  for (const line of journal.journalLines) {
                    if (line.accountCode === account.code && line.lineAmount) {
                      if (!ytdBalances[account.code]) {
                        ytdBalances[account.code] = 0;
                      }
                      ytdBalances[account.code] += line.lineAmount;
                    }
                  }
                }
              }
            } catch (journalError) {
              // Continue
            }
            
            processedAccounts++;
            
          } catch (error: any) {
            console.log(`Could not get transactions for account ${account.code}:`, error.message);
          }
        }));
        
        // Add delay between batches to avoid rate limits
        if (i + batchSize < xeroAccounts.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`Processed ${Math.min(i + batchSize, xeroAccounts.length)} of ${xeroAccounts.length} accounts...`);
      }
      
      console.log(`Total accounts processed: ${processedAccounts}`);
      console.log(`Accounts with YTD data: ${Object.keys(ytdBalances).length}`);
      
      // Get all accounts from database to merge with YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      // Merge YTD data with account information
      const accountsWithYTD = accounts.map(account => {
        let ytdAmount = 0;
        
        if (account.code && ytdBalances[account.code] !== undefined) {
          ytdAmount = ytdBalances[account.code];
          
          // Adjust sign for display based on normal balance
          const accountType = accountTypes[account.code] || account.type;
          if (['REVENUE', 'LIABILITY', 'EQUITY', 'CURRLIAB', 'TERMLIAB', 'OTHERINCOME'].includes(accountType)) {
            ytdAmount = -ytdAmount;
          }
        }
        
        return {
          ...account,
          ytdAmount
        };
      });

      // Count accounts with YTD data
      const accountsWithData = accountsWithYTD.filter(a => a.ytdAmount !== 0).length;

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
        hasYTDData: accountsWithData > 0,
        ytdBalances,
        summary: {
          totalAccounts: accounts.length,
          accountsWithBalance: accountsWithData,
          accountsProcessed: processedAccounts,
          uniqueAccountsWithTransactions: Object.keys(ytdBalances).length
        },
        period: {
          from: startOfYear.toISOString(),
          to: currentDate.toISOString()
        }
      });

    } catch (xeroError: any) {
      console.error('Xero API error:', xeroError.response?.body || xeroError);
      
      // If Xero fails, return accounts without YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      return NextResponse.json({
        success: false,
        accounts: {
          all: accounts.map(acc => ({ ...acc, ytdAmount: 0 })),
          byType: accounts.reduce((acc, account) => {
            const type = account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push({ ...account, ytdAmount: 0 });
            return acc;
          }, {} as Record<string, any[]>)
        },
        hasYTDData: false,
        error: 'Failed to fetch YTD from account transactions',
        message: xeroError.response?.body?.message || xeroError.message
      });
    }

  } catch (error: any) {
    console.error('Error in YTD account transactions endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch YTD from account transactions',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
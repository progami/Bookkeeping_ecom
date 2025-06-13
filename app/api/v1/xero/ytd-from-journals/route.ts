import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Fetching YTD from Journal Entries ===');
    
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
    
    console.log(`Fetching journal entries from ${startOfYear.toISOString().split('T')[0]} to now...`);
    
    try {
      // Initialize YTD balances
      const ytdBalances: Record<string, number> = {};
      
      // Fetch journal entries page by page
      let offset = 0;
      let hasMore = true;
      let totalJournals = 0;
      
      while (hasMore) {
        try {
          const journalsResponse = await xero.accountingApi.getJournals(
            tenantId,
            startOfYear,     // If-Modified-Since
            offset,          // offset
            false            // paymentsOnly
          );
          
          const journals = journalsResponse.body.journals || [];
          totalJournals += journals.length;
          
          console.log(`Processing ${journals.length} journals (offset: ${offset})...`);
          
          // Process each journal
          for (const journal of journals) {
            if (journal.journalLines) {
              for (const line of journal.journalLines) {
                if (line.accountCode && line.netAmount !== undefined) {
                  // Initialize account if not exists
                  if (!ytdBalances[line.accountCode]) {
                    ytdBalances[line.accountCode] = 0;
                  }
                  
                  // Add the amount (positive for debit, negative for credit based on account type)
                  ytdBalances[line.accountCode] += line.netAmount || 0;
                }
              }
            }
          }
          
          // Check if there are more pages
          hasMore = journals.length === 100; // Xero returns max 100 per page
          offset += journals.length;
          
          // Add a small delay to avoid rate limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (pageError: any) {
          if (pageError.response?.statusCode === 429) {
            // Rate limited, wait and retry
            const retryAfter = parseInt(pageError.response.headers['retry-after'] || '5');
            console.log(`Rate limited, waiting ${retryAfter} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          throw pageError;
        }
      }
      
      console.log(`Total journals processed: ${totalJournals}`);
      console.log(`Total accounts with YTD: ${Object.keys(ytdBalances).length}`);
      
      // Also try to get opening balances from the first day of the year
      try {
        const openingBalanceDate = new Date(currentDate.getFullYear() - 1, 11, 31); // Last day of previous year
        const tbResponse = await xero.accountingApi.getReportTrialBalance(
          tenantId,
          openingBalanceDate.toISOString().split('T')[0],
          false
        );
        
        if (tbResponse.body.reports && tbResponse.body.reports.length > 0) {
          const report = tbResponse.body.reports[0];
          
          // Get account mapping
          const accountsResponse = await xero.accountingApi.getAccounts(
            tenantId,
            undefined,
            undefined,
            'Code ASC'
          );
          
          const accountIdToCode: Record<string, string> = {};
          const xeroAccounts = accountsResponse.body.accounts || [];
          xeroAccounts.forEach(account => {
            if (account.accountID && account.code) {
              accountIdToCode[account.accountID] = account.code;
            }
          });
          
          // Process Trial Balance for opening balances
          if (report.rows) {
            for (const section of report.rows) {
              if (section.rowType?.toString() === 'Section' && section.rows) {
                for (const row of section.rows) {
                  if (row.cells && row.cells.length >= 3) {
                    const accountCell = row.cells[0];
                    const debitCell = row.cells[1];
                    const creditCell = row.cells[2];
                    
                    if (accountCell && accountCell.attributes) {
                      const accountAttr = accountCell.attributes.find((attr: any) => 
                        attr.id === 'account' || attr.name === 'account'
                      );
                      
                      if (accountAttr && accountAttr.value) {
                        const accountId = accountAttr.value;
                        const accountCode = accountIdToCode[accountId];
                        
                        if (accountCode) {
                          let openingBalance = 0;
                          
                          if (debitCell && debitCell.value) {
                            openingBalance += parseFloat(debitCell.value.toString().replace(/[^0-9.-]/g, '')) || 0;
                          }
                          
                          if (creditCell && creditCell.value) {
                            openingBalance -= parseFloat(creditCell.value.toString().replace(/[^0-9.-]/g, '')) || 0;
                          }
                          
                          // Add opening balance to YTD
                          if (!ytdBalances[accountCode]) {
                            ytdBalances[accountCode] = 0;
                          }
                          ytdBalances[accountCode] += openingBalance;
                          
                          if (openingBalance !== 0) {
                            console.log(`Added opening balance for ${accountCode}: ${openingBalance}`);
                          }
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
        console.log('Could not fetch opening balances:', tbError.message);
      }
      
      // Get all accounts from database to merge with YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });
      
      // Get account types from Xero for proper balance calculation
      const accountTypes: Record<string, string> = {};
      const accountsResponse = await xero.accountingApi.getAccounts(
        tenantId,
        undefined,
        undefined,
        'Code ASC'
      );
      
      (accountsResponse.body.accounts || []).forEach(account => {
        if (account.code && account.type) {
          accountTypes[account.code] = account.type.toString();
        }
      });

      // Merge YTD data with account information
      const accountsWithYTD = accounts.map(account => {
        let ytdAmount = 0;
        
        if (account.code && ytdBalances[account.code] !== undefined) {
          ytdAmount = ytdBalances[account.code];
          
          // Adjust sign based on account type (credit accounts show as negative)
          const accountType = accountTypes[account.code] || account.type;
          if (['REVENUE', 'LIABILITY', 'EQUITY', 'CURRLIAB', 'TERMLIAB'].includes(accountType)) {
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
          journalsProcessed: totalJournals,
          uniqueAccountsInJournals: Object.keys(ytdBalances).length
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
        error: 'Failed to fetch YTD from journals',
        message: xeroError.response?.body?.message || xeroError.message
      });
    }

  } catch (error: any) {
    console.error('Error in YTD from journals endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch YTD from journals',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
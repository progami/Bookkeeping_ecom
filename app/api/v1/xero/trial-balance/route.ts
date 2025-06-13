import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Fetching Trial Balance with YTD ===');
    
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
    
    // Get current date for the trial balance
    const currentDate = new Date();
    
    console.log('Fetching Trial Balance from Xero...');
    
    try {
      // Fetch Trial Balance report from Xero
      const tbReport = await xero.accountingApi.getReportTrialBalance(
        tenantId,
        currentDate.toISOString().split('T')[0], // date
        false // paymentsOnly
      );

      console.log('Trial Balance response received');

      // First, fetch all accounts to create a mapping of account IDs to codes
      const accountsResponse = await xero.accountingApi.getAccounts(
        tenantId,
        undefined,
        undefined,
        'Code ASC'
      );
      
      const xeroAccounts = accountsResponse.body.accounts || [];
      const accountIdToCode: Record<string, string> = {};
      
      // Create mapping of account ID to account code
      xeroAccounts.forEach(account => {
        if (account.accountID && account.code) {
          accountIdToCode[account.accountID] = account.code;
        }
      });
      
      console.log('Account ID to Code mapping created:', Object.keys(accountIdToCode).length);

      // Parse the Trial Balance report to extract YTD amounts by account code
      const ytdBalances: Record<string, number> = {};
      
      if (tbReport.body.reports && tbReport.body.reports.length > 0) {
        const report = tbReport.body.reports[0];
        
        console.log('Processing Trial Balance report...');
        
        // Process each row in the report
        if (report.rows) {
          for (const section of report.rows) {
            // Skip section headers
            if (section.rowType?.toString() === 'Section' && section.rows) {
              for (const row of section.rows) {
                if (row.cells && row.cells.length >= 3) {
                  // Trial balance format: Account Name | Debit | Credit
                  const accountCell = row.cells[0];
                  const debitCell = row.cells[1];
                  const creditCell = row.cells[2];
                  
                  // Look for account ID in the first cell
                  if (accountCell && accountCell.attributes) {
                    const accountAttr = accountCell.attributes.find((attr: any) => 
                      attr.id === 'account' || attr.name === 'account'
                    );
                    
                    if (accountAttr && accountAttr.value) {
                      const accountId = accountAttr.value;
                      const accountCode = accountIdToCode[accountId];
                      
                      if (accountCode) {
                        let balance = 0;
                        
                        // Calculate net balance (debit - credit)
                        if (debitCell && debitCell.value) {
                          const debitAmount = parseFloat(debitCell.value.toString().replace(/[^0-9.-]/g, ''));
                          if (!isNaN(debitAmount)) {
                            balance += debitAmount;
                          }
                        }
                        
                        if (creditCell && creditCell.value) {
                          const creditAmount = parseFloat(creditCell.value.toString().replace(/[^0-9.-]/g, ''));
                          if (!isNaN(creditAmount)) {
                            balance -= creditAmount;
                          }
                        }
                        
                        if (balance !== 0) {
                          ytdBalances[accountCode] = balance;
                          console.log(`Found balance: ${accountCode} = ${balance}`);
                        }
                      } else {
                        console.log(`No code found for account ID: ${accountId}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      console.log(`Total accounts with balances: ${Object.keys(ytdBalances).length}`);

      // Get all accounts from database to merge with YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      // Merge YTD data with account information
      const accountsWithYTD = accounts.map(account => ({
        ...account,
        ytdAmount: account.code ? (ytdBalances[account.code] || 0) : 0
      }));

      // Count how many accounts have YTD data
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
          balancesFound: Object.keys(ytdBalances).length
        },
        period: {
          asOf: currentDate.toISOString()
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
        error: 'Failed to fetch Trial Balance from Xero',
        message: xeroError.response?.body?.message || xeroError.message
      });
    }

  } catch (error: any) {
    console.error('Error in trial balance endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch trial balance',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
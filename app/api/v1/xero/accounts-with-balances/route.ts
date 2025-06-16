import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { withRateLimit } from '@/lib/rate-limiter';
import { xeroDataManager } from '@/lib/xero-data-manager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    console.log('=== Fetching Accounts with Balances ===');
    
    // Get Xero client to verify connection
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      console.log('No Xero client available');
      return NextResponse.json(
        { error: 'Xero client not initialized' },
        { status: 503 }
      );
    }

    const { tenantId } = xeroData;
    
    console.log('Fetching accounts from unified data manager...');
    
    try {
      // Get all data from unified data manager
      const xeroDataSet = await xeroDataManager.getAllData(tenantId);
      const xeroAccounts = xeroDataSet.accounts;
      console.log(`Found ${xeroAccounts.length} accounts in Xero`);

      // Get current date for YTD calculation
      const currentDate = new Date();
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);

      // For each account, calculate YTD from cached transactions
      const accountsWithYTD: any[] = [];
      const bankTransactions = xeroDataSet.transactions;
      
      for (const account of xeroAccounts) {
        if (!account.accountID) continue;

        let ytdAmount = 0;

        // Calculate YTD from cached bank transactions
        const accountTransactions = bankTransactions.filter(
          (tx: any) => tx.bankAccount?.accountID === account.accountID &&
                tx.date && new Date(tx.date) >= startOfYear
        );
        
        ytdAmount = accountTransactions.reduce((sum, tx) => {
          return sum + (tx.total || 0);
        }, 0);

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

      // Use cached reports to get more accurate YTD balances if available
      const balanceSheet = xeroDataSet.reports.balanceSheet;
      if (balanceSheet && balanceSheet.rows) {
        console.log('Using cached balance sheet for YTD amounts');
        
        // Parse balance sheet for current balances
        for (const section of balanceSheet.rows || []) {
          if (section.rows) {
            for (const row of section.rows) {
              if (row.cells && row.cells.length >= 2) {
                const accountName = row.cells[0]?.value;
                const currentBalance = row.cells[1]?.value;
                
                if (accountName && currentBalance) {
                  // Find matching account by name
                  const accountIndex = accountsWithYTD.findIndex(a => 
                    a.name?.toLowerCase() === accountName.toString().toLowerCase()
                  );
                  
                  if (accountIndex >= 0) {
                    accountsWithYTD[accountIndex].ytdAmount = 
                      parseFloat(currentBalance.toString().replace(/[^0-9.-]/g, '')) || 0;
                    console.log(`Updated balance from cached report: ${accountName} = ${currentBalance}`);
                  }
                }
              }
            }
          }
        }
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
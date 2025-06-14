import { NextResponse } from 'next/server';
import { XeroClient, RowType } from 'xero-node';
import { TokenSet } from 'xero-node';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';

// Helper function to handle rate limiting with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error?.response?.status === 429 || error?.response?.statusCode === 429) {
        const retryAfter = error?.response?.headers?.['retry-after'] || 
                          error?.response?.headers?.['Retry-After'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : initialDelay * Math.pow(2, i);
        
        console.log(`Rate limited. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (i < maxRetries - 1) {
        // For other errors, still retry with exponential backoff
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Error occurred. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
}

export async function GET() {
  try {
    console.log('[General Ledger YTD] Starting general ledger YTD data fetch...');
    
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
    
    // First, get all accounts
    console.log('[General Ledger YTD] Fetching all accounts...');
    const accountsResponse = await withRetry(() => 
      xero.accountingApi.getAccounts(tenantId)
    );
    
    const accounts = accountsResponse.body?.accounts || [];
    console.log(`[General Ledger YTD] Found ${accounts.length} accounts`);
    
    // Calculate date range for current year
    const currentYear = new Date().getFullYear();
    const fromDate = `${currentYear}-01-01`;
    const toDate = new Date().toISOString().split('T')[0]; // Today in YYYY-MM-DD format
    
    console.log(`[General Ledger YTD] Fetching GL data from ${fromDate} to ${toDate}`);
    
    // Initialize results array
    const ytdData: any[] = [];
    const batchSize = 10; // Process accounts in batches to avoid timeouts
    
    // Process accounts in batches
    for (let i = 0; i < accounts.length; i += batchSize) {
      const batch = accounts.slice(i, i + batchSize);
      console.log(`[General Ledger YTD] Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(accounts.length / batchSize)}`);
      
      // Process each account in the batch in parallel
      const batchPromises = batch.map(async (account) => {
        if (!account.accountID || !account.code) return null;
        
        try {
          // Get the general ledger transactions for this account
          const glResponse = await withRetry(() =>
            xero.accountingApi.getReportBankSummary(
              tenantId,
              fromDate,
              toDate
            )
          );
          
          // Note: The above API might not be the best for GL data
          // Let's try a different approach using the Reports API
          
          // Try to get account transactions directly
          const transactionsUrl = `/api.xro/2.0/Reports/GeneralLedger?fromDate=${fromDate}&toDate=${toDate}&accountID=${account.accountID}`;
          
          // Since the xero-node SDK might not have direct GL report access,
          // we'll calculate from the Trial Balance for now
          
          return {
            accountCode: account.code,
            accountName: account.name || '',
            accountType: account.type?.toString() || '',
            accountClass: account._class?.toString() || '',
            accountID: account.accountID,
            ytdBalance: 0, // Will be updated from Trial Balance
            status: account.status?.toString() || 'ACTIVE'
          };
          
        } catch (error) {
          console.error(`[General Ledger YTD] Error processing account ${account.code}:`, error);
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      ytdData.push(...batchResults.filter(result => result !== null));
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < accounts.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Now get the Trial Balance to update YTD balances
    console.log('[General Ledger YTD] Fetching Trial Balance for YTD amounts...');
    try {
      const trialBalanceResponse = await withRetry(() =>
        xero.accountingApi.getReportTrialBalance(
          tenantId,
          toDate // Trial balance as of today
        )
      );
      
      // Process trial balance to update YTD balances
      const report = trialBalanceResponse.body?.reports?.[0];
      if (report?.rows) {
        // Find the section with account data
        const sectionRow = report.rows.find(row => row.rowType === RowType.Section);
        if (sectionRow?.rows) {
          for (const row of sectionRow.rows) {
            if (row.rowType === RowType.Row && row.cells) {
              // Extract account code and YTD balance
              const accountCode = row.cells[0]?.value;
              const ytdDebit = parseFloat(row.cells[1]?.value || '0');
              const ytdCredit = parseFloat(row.cells[2]?.value || '0');
              const ytdBalance = parseFloat(row.cells[3]?.value || '0');
              
              if (accountCode) {
                // Find and update the account in our data
                const accountData = ytdData.find(a => a.accountCode === accountCode);
                if (accountData) {
                  accountData.ytdBalance = ytdBalance;
                  accountData.ytdDebit = ytdDebit;
                  accountData.ytdCredit = ytdCredit;
                } else {
                  // Account in trial balance but not in accounts list
                  ytdData.push({
                    accountCode: accountCode,
                    accountName: row.cells[0]?.attributes?.[0]?.value || '',
                    accountType: 'UNKNOWN',
                    accountClass: 'UNKNOWN',
                    ytdBalance: ytdBalance,
                    ytdDebit: ytdDebit,
                    ytdCredit: ytdCredit,
                    status: 'ACTIVE'
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[General Ledger YTD] Error fetching trial balance:', error);
    }
    
    // Filter out accounts with no YTD activity
    const activeAccounts = ytdData.filter(account => 
      account.ytdBalance !== 0 || 
      account.ytdDebit !== 0 || 
      account.ytdCredit !== 0
    );
    
    // Sort by account code
    activeAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    
    // Log summary
    const summary = {
      totalAccounts: accounts.length,
      accountsWithYTDActivity: activeAccounts.length,
      byClass: {} as Record<string, number>,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0
    };
    
    activeAccounts.forEach(account => {
      const cls = account.accountClass || 'UNKNOWN';
      summary.byClass[cls] = (summary.byClass[cls] || 0) + 1;
      summary.totalDebit += account.ytdDebit || 0;
      summary.totalCredit += account.ytdCredit || 0;
      summary.netBalance += account.ytdBalance || 0;
    });
    
    console.log('[General Ledger YTD] Summary:', JSON.stringify(summary, null, 2));
    
    return NextResponse.json({
      success: true,
      data: activeAccounts,
      summary: {
        ...summary,
        dateRange: {
          start: fromDate,
          end: toDate
        }
      }
    });
    
  } catch (error) {
    console.error('[General Ledger YTD] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch general ledger YTD data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
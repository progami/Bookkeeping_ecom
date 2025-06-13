import { NextResponse } from 'next/server';
import { XeroClient } from 'xero-node';
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
    console.log('[All Accounts YTD] Starting comprehensive account data fetch...');
    
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
    
    // Initialize comprehensive account map
    const accountMap = new Map<string, {
      accountCode: string;
      accountName: string;
      accountType: string;
      accountClass: string;
      accountID: string;
      status: string;
      ytdBalance: number;
      ytdDebit: number;
      ytdCredit: number;
      transactionCount: number;
      lastTransactionDate?: Date;
    }>();
    
    // Step 1: Get ALL accounts from the Chart of Accounts
    console.log('[All Accounts YTD] Step 1: Fetching all accounts from Chart of Accounts...');
    const accountsResponse = await withRetry(() => 
      xero.accountingApi.getAccounts(tenantId)
    );
    
    const allAccounts = accountsResponse.body?.accounts || [];
    console.log(`[All Accounts YTD] Found ${allAccounts.length} accounts in Chart of Accounts`);
    
    // Initialize all accounts in the map
    allAccounts.forEach(account => {
      if (account.code) {
        accountMap.set(account.code, {
          accountCode: account.code,
          accountName: account.name || '',
          accountType: account.type?.toString() || '',
          accountClass: account.class?.toString() || '',
          accountID: account.accountID || '',
          status: account.status?.toString() || 'ACTIVE',
          ytdBalance: 0,
          ytdDebit: 0,
          ytdCredit: 0,
          transactionCount: 0
        });
      }
    });
    
    // Calculate date range for current year
    const currentYear = new Date().getFullYear();
    const fromDate = `${currentYear}-01-01`;
    const toDate = new Date().toISOString().split('T')[0];
    
    // Step 2: Get Trial Balance (this gives us YTD balances)
    console.log('[All Accounts YTD] Step 2: Fetching Trial Balance...');
    try {
      const trialBalanceResponse = await withRetry(() =>
        xero.accountingApi.getReportTrialBalance(tenantId, toDate)
      );
      
      const report = trialBalanceResponse.body?.reports?.[0];
      if (report?.rows) {
        const sectionRow = report.rows.find(row => row.rowType === 'Section');
        if (sectionRow?.rows) {
          for (const row of sectionRow.rows) {
            if (row.rowType === 'Row' && row.cells) {
              const accountCode = row.cells[0]?.value;
              const ytdDebit = parseFloat(row.cells[1]?.value || '0');
              const ytdCredit = parseFloat(row.cells[2]?.value || '0');
              const ytdBalance = parseFloat(row.cells[3]?.value || '0');
              
              if (accountCode) {
                const account = accountMap.get(accountCode);
                if (account) {
                  account.ytdBalance = ytdBalance;
                  account.ytdDebit = ytdDebit;
                  account.ytdCredit = ytdCredit;
                  if (ytdDebit > 0 || ytdCredit > 0) {
                    account.transactionCount = 1; // At least one transaction
                  }
                }
              }
            }
          }
        }
      }
      console.log('[All Accounts YTD] Trial Balance processed successfully');
    } catch (error) {
      console.error('[All Accounts YTD] Error fetching trial balance:', error);
    }
    
    // Step 3: Get Profit & Loss report to ensure we capture all P&L accounts
    console.log('[All Accounts YTD] Step 3: Fetching Profit & Loss report...');
    try {
      const plResponse = await withRetry(() =>
        xero.accountingApi.getReportProfitAndLoss(
          tenantId,
          fromDate,
          toDate,
          undefined, // periods
          undefined, // timeframe
          undefined, // trackingCategoryID
          undefined, // trackingCategoryID2
          undefined, // trackingOptionID
          undefined, // trackingOptionID2
          true, // standardLayout
          false // paymentsOnly
        )
      );
      
      const plReport = plResponse.body?.reports?.[0];
      if (plReport?.rows) {
        // Process each section in the P&L report
        plReport.rows.forEach(section => {
          if (section.rows) {
            section.rows.forEach(row => {
              if (row.cells && row.cells[0]?.value) {
                // Look for account code in attributes
                const accountCode = row.cells[0]?.attributes?.find(attr => attr.id === 'accountCode')?.value;
                if (accountCode) {
                  const amount = parseFloat(row.cells[1]?.value || '0');
                  const account = accountMap.get(accountCode);
                  if (account && amount !== 0) {
                    // Update account if not already set by Trial Balance
                    if (account.ytdBalance === 0) {
                      account.ytdBalance = amount;
                      if (amount > 0) {
                        account.ytdDebit = amount;
                      } else {
                        account.ytdCredit = Math.abs(amount);
                      }
                    }
                    account.transactionCount = Math.max(account.transactionCount, 1);
                  }
                }
              }
            });
          }
        });
      }
      console.log('[All Accounts YTD] Profit & Loss report processed successfully');
    } catch (error) {
      console.error('[All Accounts YTD] Error fetching P&L report:', error);
    }
    
    // Step 4: Get Balance Sheet report to ensure we capture all balance sheet accounts
    console.log('[All Accounts YTD] Step 4: Fetching Balance Sheet report...');
    try {
      const bsResponse = await withRetry(() =>
        xero.accountingApi.getReportBalanceSheet(
          tenantId,
          toDate,
          undefined, // periods
          undefined, // timeframe
          undefined, // trackingCategoryID
          undefined, // trackingCategoryID2
          undefined, // trackingOptionID
          undefined, // trackingOptionID2
          true, // standardLayout
          false // paymentsOnly
        )
      );
      
      const bsReport = bsResponse.body?.reports?.[0];
      if (bsReport?.rows) {
        // Process each section in the Balance Sheet report
        bsReport.rows.forEach(section => {
          if (section.rows) {
            section.rows.forEach(row => {
              if (row.cells && row.cells[0]?.value) {
                // Look for account code in attributes
                const accountCode = row.cells[0]?.attributes?.find(attr => attr.id === 'accountCode')?.value;
                if (accountCode) {
                  const amount = parseFloat(row.cells[1]?.value || '0');
                  const account = accountMap.get(accountCode);
                  if (account && amount !== 0) {
                    // Update account if not already set
                    if (account.ytdBalance === 0) {
                      account.ytdBalance = amount;
                      if (amount > 0) {
                        account.ytdDebit = amount;
                      } else {
                        account.ytdCredit = Math.abs(amount);
                      }
                    }
                    account.transactionCount = Math.max(account.transactionCount, 1);
                  }
                }
              }
            });
          }
        });
      }
      console.log('[All Accounts YTD] Balance Sheet report processed successfully');
    } catch (error) {
      console.error('[All Accounts YTD] Error fetching Balance Sheet report:', error);
    }
    
    // Step 5: Get recent transactions to find accounts with activity
    console.log('[All Accounts YTD] Step 5: Checking recent transactions...');
    try {
      // Get bank transactions
      const bankTransResponse = await withRetry(() =>
        xero.accountingApi.getBankTransactions(
          tenantId,
          undefined, // ifModifiedSince
          `Date >= DateTime(${currentYear}, 01, 01)`, // where
          undefined, // order
          undefined, // page
          100 // unitdp
        )
      );
      
      const bankTransactions = bankTransResponse.body?.bankTransactions || [];
      console.log(`[All Accounts YTD] Found ${bankTransactions.length} bank transactions`);
      
      bankTransactions.forEach(trans => {
        if (trans.lineItems) {
          trans.lineItems.forEach(line => {
            if (line.accountCode) {
              const account = accountMap.get(line.accountCode);
              if (account) {
                account.transactionCount++;
                if (trans.date) {
                  const transDate = new Date(trans.date);
                  if (!account.lastTransactionDate || transDate > account.lastTransactionDate) {
                    account.lastTransactionDate = transDate;
                  }
                }
              }
            }
          });
        }
      });
      
      // Get invoices
      const invoicesResponse = await withRetry(() =>
        xero.accountingApi.getInvoices(
          tenantId,
          undefined, // ifModifiedSince
          `Date >= DateTime(${currentYear}, 01, 01)`, // where
          undefined, // order
          undefined, // invoiceNumbers
          undefined, // contactIDs
          undefined, // statuses
          undefined, // page
          undefined, // includeArchived
          undefined, // createdByMyApp
          100 // unitdp
        )
      );
      
      const invoices = invoicesResponse.body?.invoices || [];
      console.log(`[All Accounts YTD] Found ${invoices.length} invoices`);
      
      invoices.forEach(invoice => {
        if (invoice.lineItems) {
          invoice.lineItems.forEach(line => {
            if (line.accountCode) {
              const account = accountMap.get(line.accountCode);
              if (account) {
                account.transactionCount++;
                if (invoice.date) {
                  const transDate = new Date(invoice.date);
                  if (!account.lastTransactionDate || transDate > account.lastTransactionDate) {
                    account.lastTransactionDate = transDate;
                  }
                }
              }
            }
          });
        }
      });
      
    } catch (error) {
      console.error('[All Accounts YTD] Error fetching transactions:', error);
    }
    
    // Convert map to array and include ALL accounts
    const allAccountsData = Array.from(accountMap.values())
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    
    // Separate active and inactive accounts
    const activeAccounts = allAccountsData.filter(a => 
      a.ytdBalance !== 0 || 
      a.ytdDebit !== 0 || 
      a.ytdCredit !== 0 || 
      a.transactionCount > 0
    );
    
    const inactiveAccounts = allAccountsData.filter(a => 
      a.ytdBalance === 0 && 
      a.ytdDebit === 0 && 
      a.ytdCredit === 0 && 
      a.transactionCount === 0
    );
    
    // Log comprehensive summary
    const summary = {
      totalAccountsInCOA: allAccountsData.length,
      accountsWithYTDActivity: activeAccounts.length,
      inactiveAccounts: inactiveAccounts.length,
      byClass: {} as Record<string, { total: number, active: number }>,
      totalYTDDebit: 0,
      totalYTDCredit: 0,
      netYTDBalance: 0
    };
    
    allAccountsData.forEach(account => {
      const cls = account.accountClass || 'UNKNOWN';
      if (!summary.byClass[cls]) {
        summary.byClass[cls] = { total: 0, active: 0 };
      }
      summary.byClass[cls].total++;
      
      if (account.ytdBalance !== 0 || account.transactionCount > 0) {
        summary.byClass[cls].active++;
        summary.totalYTDDebit += account.ytdDebit;
        summary.totalYTDCredit += account.ytdCredit;
        summary.netYTDBalance += account.ytdBalance;
      }
    });
    
    console.log('[All Accounts YTD] Comprehensive Summary:', JSON.stringify(summary, null, 2));
    
    return NextResponse.json({
      success: true,
      data: {
        all: allAccountsData,
        active: activeAccounts,
        inactive: inactiveAccounts
      },
      summary: {
        ...summary,
        dateRange: {
          start: fromDate,
          end: toDate
        },
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('[All Accounts YTD] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch all accounts YTD data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
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
    console.log('[Comprehensive YTD] Starting comprehensive YTD data fetch...');
    
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
    
    // Calculate date range for current year
    const currentYear = new Date().getFullYear();
    const startDate = new Date(`${currentYear}-01-01`);
    const endDate = new Date(); // Today
    
    console.log(`[Comprehensive YTD] Fetching journals from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Initialize account balances map
    const accountBalances = new Map<string, {
      accountCode: string;
      accountName: string;
      accountType: string;
      accountClass: string;
      balance: number;
      transactionCount: number;
    }>();
    
    // First, get all accounts to have complete information
    console.log('[Comprehensive YTD] Fetching all accounts...');
    const accountsResponse = await withRetry(() => 
      xero.accountingApi.getAccounts(tenantId)
    );
    
    const accountsMap = new Map();
    if (accountsResponse.body?.accounts) {
      accountsResponse.body.accounts.forEach(account => {
        if (account.code) {
          accountsMap.set(account.code, {
            accountCode: account.code,
            accountName: account.name || '',
            accountType: account.type?.toString() || '',
            accountClass: account._class?.toString() || '',
            balance: 0,
            transactionCount: 0
          });
        }
      });
    }
    
    console.log(`[Comprehensive YTD] Found ${accountsMap.size} accounts`);
    
    // Fetch all journals with pagination
    let offset = 0;
    const pageSize = 100; // Xero's max page size
    let hasMorePages = true;
    let totalJournals = 0;
    let totalJournalLines = 0;
    
    while (hasMorePages) {
      console.log(`[Comprehensive YTD] Fetching journals page with offset ${offset}...`);
      
      try {
        const journalsResponse = await withRetry(() => 
          xero.accountingApi.getJournals(
            tenantId,
            undefined, // ifModifiedSince
            offset
          )
        );
        
        const journals = journalsResponse.body?.journals || [];
        console.log(`[Comprehensive YTD] Retrieved ${journals.length} journals in this page`);
        
        if (journals.length === 0) {
          hasMorePages = false;
          break;
        }
        
        // Process each journal
        for (const journal of journals) {
          if (!journal.journalLines) continue;
          
          // Check if journal date is within our year range
          const journalDate = journal.journalDate ? new Date(journal.journalDate) : null;
          if (!journalDate || journalDate < startDate || journalDate > endDate) {
            continue;
          }
          
          totalJournals++;
          
          // Process each journal line
          for (const line of journal.journalLines) {
            if (!line.accountCode) continue;
            
            totalJournalLines++;
            
            // Get or create account entry
            let accountData = accountBalances.get(line.accountCode);
            if (!accountData) {
              // Try to get account info from our accounts map
              const accountInfo = accountsMap.get(line.accountCode);
              if (accountInfo) {
                accountData = { ...accountInfo };
              } else {
                // Create a basic entry if account wasn't in the accounts list
                accountData = {
                  accountCode: line.accountCode,
                  accountName: line.accountName || '',
                  accountType: line.accountType?.toString() || '',
                  accountClass: '',
                  balance: 0,
                  transactionCount: 0
                };
              }
              accountBalances.set(line.accountCode, accountData!);
            }
            
            // Update balance
            // In Xero journals, positive amounts are debits, negative are credits
            // For asset and expense accounts, debits increase the balance
            // For liability, equity, and revenue accounts, credits increase the balance
            const amount = line.netAmount || 0;
            if (!accountData) continue; // TypeScript safety check
            const accountType = accountData.accountType.toUpperCase();
            const accountClass = accountData.accountClass.toUpperCase();
            
            // Determine if this is a debit or credit based on the amount
            const isDebit = amount >= 0;
            
            // Apply accounting rules for balance calculation
            if (accountClass === 'ASSET' || accountClass === 'EXPENSE') {
              // For assets and expenses: debits increase, credits decrease
              accountData.balance += amount;
            } else if (accountClass === 'LIABILITY' || accountClass === 'EQUITY' || accountClass === 'REVENUE') {
              // For liabilities, equity, and revenue: credits increase, debits decrease
              accountData.balance -= amount;
            } else {
              // Fallback: use the amount as-is
              accountData.balance += amount;
            }
            
            accountData.transactionCount++;
          }
        }
        
        // Check if we have more pages
        if (journals.length < pageSize) {
          hasMorePages = false;
        } else {
          offset += pageSize;
          
          // Add a small delay between pages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error('[Comprehensive YTD] Error fetching journals page:', error);
        throw error;
      }
    }
    
    console.log(`[Comprehensive YTD] Processed ${totalJournals} journals with ${totalJournalLines} journal lines`);
    console.log(`[Comprehensive YTD] Found YTD data for ${accountBalances.size} accounts`);
    
    // Convert map to array and sort by account code
    const ytdData = Array.from(accountBalances.values())
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      .map(account => ({
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        accountClass: account.accountClass,
        ytdBalance: account.balance,
        transactionCount: account.transactionCount
      }));
    
    // Log summary
    const summary = {
      totalAccounts: ytdData.length,
      accountsWithTransactions: ytdData.filter(a => a.transactionCount > 0).length,
      totalTransactions: ytdData.reduce((sum, a) => sum + a.transactionCount, 0),
      byClass: {} as Record<string, number>
    };
    
    ytdData.forEach(account => {
      const cls = account.accountClass || 'UNKNOWN';
      summary.byClass[cls] = (summary.byClass[cls] || 0) + 1;
    });
    
    console.log('[Comprehensive YTD] Summary:', JSON.stringify(summary, null, 2));
    
    return NextResponse.json({
      success: true,
      data: ytdData,
      summary: {
        ...summary,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        journalsProcessed: totalJournals,
        journalLinesProcessed: totalJournalLines
      }
    });
    
  } catch (error) {
    console.error('[Comprehensive YTD] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch comprehensive YTD data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}
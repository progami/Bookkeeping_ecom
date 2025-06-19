import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient, getStoredTokenSet } from '@/lib/xero-client';
import { AccountType } from 'xero-node';

export async function GET(request: NextRequest) {
  try {
    console.log('Chart of Accounts API called');
    
    // Debug: Check if we have the token
    const tokenSet = await getStoredTokenSet();
    console.log('Token check in chart-of-accounts:', {
      hasToken: !!tokenSet,
      hasAccessToken: tokenSet ? !!tokenSet.access_token : false
    });
    
    // Try simpler approach - get client and manually get tenant
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      console.log('No Xero client available');
      return NextResponse.json(
        { error: 'Xero client not initialized' },
        { status: 503 }
      );
    }

    // Update tenants and get the first one
    try {
      await xeroClient.updateTenants();
    } catch (error) {
      console.error('Failed to update tenants:', error);
      return NextResponse.json(
        { error: 'Failed to connect to Xero - please reconnect from dashboard' },
        { status: 503 }
      );
    }

    const tenants = xeroClient.tenants;
    if (!tenants || tenants.length === 0) {
      console.log('No tenants found');
      return NextResponse.json(
        { error: 'No Xero organizations found' },
        { status: 503 }
      );
    }

    const tenantId = tenants[0].tenantId;
    console.log('Using tenant:', tenantId, tenants[0].tenantName);

    // Check if user wants balance data
    const searchParams = request.nextUrl.searchParams;
    const includeBalances = searchParams.get('includeBalances') === 'true';

    // Get all accounts from Xero
    const response = await xeroClient.accountingApi.getAccounts(
      tenantId,
      undefined, // IFModifiedSince
      'Status=="ACTIVE"', // where filter for active accounts only
      'Code ASC' // order by code
    );

    // Get account balances using Trial Balance if requested
    let accountBalances: Record<string, number> = {};
    
    if (includeBalances) {
      try {
        const currentDate = new Date();
        
        console.log('Fetching Trial Balance for account balances...');
        const trialBalanceResponse = await xeroClient.accountingApi.getReportTrialBalance(
          tenantId,
          currentDate.toISOString().split('T')[0]
        );

        // Parse the Trial Balance report to extract account balances
        if (trialBalanceResponse.body.reports && trialBalanceResponse.body.reports.length > 0) {
          const report = trialBalanceResponse.body.reports[0];
          
          // Process each row in the trial balance
          report.rows?.forEach((row: any) => {
            if (row.rowType === 'Section' && row.rows) {
              row.rows.forEach((accountRow: any) => {
                if (accountRow.rowType === 'Row' && accountRow.cells) {
                  // Get account code and debit/credit amounts
                  const accountCode = accountRow.cells[0]?.value;
                  const debitAmount = parseFloat(accountRow.cells[1]?.value) || 0;
                  const creditAmount = parseFloat(accountRow.cells[2]?.value) || 0;
                  
                  if (accountCode) {
                    // Net balance = debit - credit
                    const netBalance = debitAmount - creditAmount;
                    accountBalances[accountCode] = netBalance;
                  }
                }
              });
            }
          });
        }
      } catch (error) {
        console.error('Error fetching Trial Balance:', error);
        // Continue without balance amounts
      }
    }

    // Transform and categorize accounts
    const accounts = response.body.accounts?.map(account => ({
      code: account.code,
      name: account.name,
      type: account.type,
      class: account._class,
      status: account.status,
      description: account.description,
      systemAccount: account.systemAccount,
      enablePaymentsToAccount: account.enablePaymentsToAccount,
      showInExpenseClaims: account.showInExpenseClaims,
      taxType: account.taxType,
      reportingCode: account.reportingCode,
      reportingCodeName: account.reportingCodeName,
      hasAttachments: account.hasAttachments,
      updatedDateUTC: account.updatedDateUTC,
      addToWatchlist: account.addToWatchlist,
      // Full account string for display
      fullName: `${account.code} - ${account.name}`,
      // Add balance if available (using account code)
      balance: accountBalances[account.code || ''] || 0
    })) || [];

    // Filter for expense accounts (commonly used in bills)
    const expenseAccounts = accounts.filter(acc => 
      acc.type === AccountType.EXPENSE || 
      acc.type === AccountType.OVERHEADS || 
      acc.type === AccountType.DIRECTCOSTS
    );

    // Get unique tax types
    const taxTypes = [...new Set(accounts.map(acc => acc.taxType).filter(Boolean))];

    // Calculate total balances if we have the data
    const totalBalance = includeBalances ? 
      accounts.reduce((sum, acc) => sum + Math.abs(acc.balance), 0) : 0;

    return NextResponse.json(
      {
        success: true,
        accounts: {
          all: accounts,
          expense: expenseAccounts,
          byType: groupAccountsByType(accounts)
        },
        taxTypes,
        count: accounts.length,
        hasBalanceData: includeBalances && Object.keys(accountBalances).length > 0,
        totalBalance,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
        }
      }
    );
  } catch (error: any) {
    console.error('Error fetching chart of accounts from Xero:', error);
    
    if (error.response?.statusCode === 401) {
      return NextResponse.json(
        { error: 'Xero authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch chart of accounts',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to group accounts by type
function groupAccountsByType(accounts: any[]) {
  return accounts.reduce((grouped, account) => {
    const type = account.type || 'OTHER';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(account);
    return grouped;
  }, {} as Record<string, any[]>);
}
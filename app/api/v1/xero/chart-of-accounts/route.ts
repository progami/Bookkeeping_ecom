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

    // Check if user wants YTD data
    const searchParams = request.nextUrl.searchParams;
    const includeYTD = searchParams.get('includeYTD') === 'true';

    // Get all accounts from Xero
    const response = await xeroClient.accountingApi.getAccounts(
      tenantId,
      undefined, // IFModifiedSince
      'Status=="ACTIVE"', // where filter for active accounts only
      'Code ASC' // order by code
    );

    // Get YTD amounts if requested
    let accountBalances: Record<string, number> = {};
    
    if (includeYTD) {
      try {
        // Get YTD from January 1st to today
        const currentDate = new Date();
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        
        console.log('Fetching P&L report for YTD amounts...');
        const plResponse = await xeroClient.accountingApi.getReportProfitAndLoss(
          tenantId,
          startOfYear.toISOString().split('T')[0],
          currentDate.toISOString().split('T')[0]
        );

        // Parse the P&L report to extract account balances
        if (plResponse.body.reports && plResponse.body.reports.length > 0) {
          const report = plResponse.body.reports[0];
          
          // Process each section of the report
          report.rows?.forEach((row: any) => {
            if (row.rowType === 'Section' && row.rows) {
              row.rows.forEach((accountRow: any) => {
                if (accountRow.rowType === 'Row' && accountRow.cells) {
                  // Get account name and amount
                  const accountName = accountRow.cells[0]?.value;
                  const amountCell = accountRow.cells[1];
                  
                  if (accountName && amountCell?.value) {
                    const amount = parseFloat(amountCell.value) || 0;
                    // Store by account name for now, we'll match by code later
                    accountBalances[accountName] = amount;
                  }
                }
              });
            }
          });
        }

        // Also fetch Balance Sheet for asset/liability accounts
        console.log('Fetching Balance Sheet for asset/liability balances...');
        const bsResponse = await xeroClient.accountingApi.getReportBalanceSheet(
          tenantId,
          currentDate.toISOString().split('T')[0]
        );

        if (bsResponse.body.reports && bsResponse.body.reports.length > 0) {
          const report = bsResponse.body.reports[0];
          
          // Process each section of the balance sheet
          report.rows?.forEach((row: any) => {
            if (row.rowType === 'Section' && row.rows) {
              row.rows.forEach((subsection: any) => {
                if (subsection.rowType === 'Section' && subsection.rows) {
                  subsection.rows.forEach((accountRow: any) => {
                    if (accountRow.rowType === 'Row' && accountRow.cells) {
                      const accountName = accountRow.cells[0]?.value;
                      const amountCell = accountRow.cells[1];
                      
                      if (accountName && amountCell?.value) {
                        const amount = parseFloat(amountCell.value) || 0;
                        accountBalances[accountName] = amount;
                      }
                    }
                  });
                } else if (subsection.rowType === 'Row' && subsection.cells) {
                  // Handle direct rows in sections
                  const accountName = subsection.cells[0]?.value;
                  const amountCell = subsection.cells[1];
                  
                  if (accountName && amountCell?.value) {
                    const amount = parseFloat(amountCell.value) || 0;
                    accountBalances[accountName] = amount;
                  }
                }
              });
            }
          });
        }
      } catch (error) {
        console.error('Error fetching YTD amounts:', error);
        // Continue without YTD amounts
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
      // Add YTD amount if available
      ytdAmount: accountBalances[account.name || ''] || 0
    })) || [];

    // Filter for expense accounts (commonly used in bills)
    const expenseAccounts = accounts.filter(acc => 
      acc.type === AccountType.EXPENSE || 
      acc.type === AccountType.OVERHEADS || 
      acc.type === AccountType.DIRECTCOSTS
    );

    // Get unique tax types
    const taxTypes = [...new Set(accounts.map(acc => acc.taxType).filter(Boolean))];

    // Calculate total YTD if we have the data
    const totalYTD = includeYTD ? 
      accounts.reduce((sum, acc) => sum + Math.abs(acc.ytdAmount), 0) : 0;

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
        hasYTDData: includeYTD && Object.keys(accountBalances).length > 0,
        totalYTD,
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
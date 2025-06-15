import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    // Set cache headers for performance
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'max-age=600',
    };

    // Get Xero client
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }

    const { client: xero, tenantId } = xeroData;

    // Get balance sheet from Xero API
    const balanceSheetResponse = await xero.accountingApi.getReportBalanceSheet(
      tenantId,
      undefined, // date - uses today if not specified
      3, // periods
      'MONTH' // timeframe
    );

    const report = balanceSheetResponse.body.reports?.[0];
    if (!report || !report.rows) {
      throw new Error('Invalid balance sheet response from Xero');
    }

    // Parse the balance sheet data
    let totalAssets = 0;
    let totalLiabilities = 0;
    let netAssets = 0;
    let cashInBank = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;
    let equity = 0;

    // Extract values from the report rows
    report.rows.forEach(row => {
      if (row.rowType === 'Section' as any) {
        const sectionTitle = row.title?.toLowerCase() || '';
        
        // Find the total row in this section
        const totalRow = row.rows?.find(r => 
          r.rowType === 'Row' as any && 
          (r.cells?.[0]?.value?.toString().toLowerCase().includes('total') || false)
        );

        if (totalRow && totalRow.cells) {
          // Get the current period value (first value cell after the label)
          const currentValue = parseFloat(totalRow.cells[1]?.value?.toString() || '0');

          if (sectionTitle.includes('asset')) {
            totalAssets = currentValue;
          } else if (sectionTitle.includes('liabilities')) {
            totalLiabilities = Math.abs(currentValue); // Liabilities are often negative
          } else if (sectionTitle.includes('equity')) {
            equity = currentValue;
          }
        }

        // Look for specific line items
        row.rows?.forEach(itemRow => {
          if (itemRow.rowType === 'Row' as any && itemRow.cells && itemRow.cells.length > 1) {
            const itemName = itemRow.cells[0]?.value?.toString().toLowerCase() || '';
            const itemValue = parseFloat(itemRow.cells[1]?.value?.toString() || '0');

            // Extract cash and bank accounts
            if (itemName.includes('cash') || itemName.includes('bank')) {
              cashInBank += itemValue;
            }

            // Track current assets/liabilities
            if (sectionTitle.includes('current asset')) {
              currentAssets += itemValue;
            } else if (sectionTitle.includes('current liabilit')) {
              currentLiabilities += Math.abs(itemValue);
            }
          }
        });
      }
    });

    // Calculate net assets
    netAssets = totalAssets - totalLiabilities;

    // Get additional bank account details if needed
    const bankAccountsResponse = await xero.accountingApi.getAccounts(
      tenantId,
      undefined,
      'Type=="BANK"&&Status=="ACTIVE"'
    );

    let detailedCashInBank = 0;
    const bankAccounts = bankAccountsResponse.body.accounts || [];
    
    // Note: getReportBankSummary in this version doesn't support account-specific queries
    // We'll rely on the balance sheet calculation instead

    // Use the more accurate value
    if (detailedCashInBank > 0) {
      cashInBank = detailedCashInBank;
    }

    return NextResponse.json({
      totalAssets,
      totalLiabilities,
      netAssets,
      equity,
      currentAssets,
      currentLiabilities,
      cashInBank,
      accountsReceivable: 0, // Would need to parse from report
      accountsPayable: 0, // Would need to parse from report
      inventory: 0, // Would need to parse from report
      reportDate: new Date().toISOString(),
      source: 'xero_api'
    }, {
      headers: responseHeaders
    });

  } catch (error: any) {
    console.error('Balance sheet API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch balance sheet from Xero',
        message: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
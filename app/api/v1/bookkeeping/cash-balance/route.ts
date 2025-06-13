import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    // Get Xero client via OAuth
    const xeroClient = await getXeroClient();
    
    if (!xeroClient) {
      return NextResponse.json({
        error: 'Not connected to Xero',
        details: 'Please connect your Xero account first'
      }, { status: 401 });
    }

    // Get the tenant ID from connected tenants
    const tenants = await xeroClient.updateTenants();
    
    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        error: 'No Xero tenants found',
        details: 'Please reconnect to Xero'
      }, { status: 401 });
    }

    const tenantId = tenants[0].tenantId;
    
    if (!tenantId) {
      return NextResponse.json({
        error: 'No tenant selected',
        details: 'Unable to determine Xero organization'
      }, { status: 400 });
    }

    console.log('Fetching balance sheet from Xero...');
    
    // Fetch balance sheet report
    const balanceSheet = await xeroClient.accountingApi.getReportBalanceSheet(
      tenantId,
      new Date().toISOString().split('T')[0]
    );
    
    // Extract bank balances from the report
    let totalCashInBank = 0;
    const bankAccounts: any[] = [];
    
    if (balanceSheet.body?.reports?.[0]?.rows) {
      const rows = balanceSheet.body.reports[0].rows;
      
      // Find the Bank section
      rows.forEach((row: any) => {
        if (row.rowType === 'Section' && row.title === 'Bank' && row.rows) {
          row.rows.forEach((bankRow: any) => {
            if (bankRow.rowType === 'Row' && bankRow.cells) {
              const accountName = bankRow.cells[0]?.value || 'Unknown';
              const balance = parseFloat(bankRow.cells[1]?.value || '0');
              
              if (!isNaN(balance)) {
                totalCashInBank += balance;
                bankAccounts.push({
                  name: accountName,
                  balance: balance,
                  currency: 'GBP'
                });
              }
            }
          });
        }
      });
    }
    
    console.log('Successfully fetched balance from Xero:', totalCashInBank);
    
    return NextResponse.json({
      success: true,
      cashInBank: totalCashInBank,
      currency: 'GBP',
      source: 'xero-api',
      lastUpdated: new Date().toISOString(),
      breakdown: bankAccounts
    });
    
  } catch (error: any) {
    console.error('Cash balance error:', error);
    return NextResponse.json({
      error: 'Failed to fetch cash balance',
      details: error.message
    }, { status: 500 });
  }
}
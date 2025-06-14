import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { RowType } from 'xero-node';

export async function GET(request: NextRequest) {
  try {
    const xeroData = await getXeroClientWithTenant()
    
    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      )
    }

    const { client, tenantId } = xeroData

    // Since getReportBASorGST is not available in all regions,
    // we'll calculate VAT liability from GL accounts instead
    const accountsResponse = await client.accountingApi.getAccounts(
      tenantId,
      undefined, // ifModifiedSince
      'Type=="CURRLIAB"&&Name.Contains("VAT")||Name.Contains("GST")||Code=="820"||Code=="825"' // where
    );
    
    const vatAccounts = accountsResponse.body?.accounts || [];
    
    // Calculate VAT liability from account balances
    let currentLiability = 0;
    let vatCollected = 0;
    let vatPaid = 0;
    
    // Get Trial Balance for current balances
    const trialBalanceResponse = await client.accountingApi.getReportTrialBalance(
      tenantId,
      undefined // date - will use today
    );
    
    const report = trialBalanceResponse.body?.reports?.[0];
    
    if (report?.rows) {
      report.rows.forEach((row: any) => {
        // Look for GST/VAT collected rows
        if (row.rowType === RowType.Row && row.cells) {
          const title = row.cells[0]?.value || '';
          const amount = parseFloat(row.cells[row.cells.length - 1]?.value || '0');
          
          if (title.toLowerCase().includes('gst collected') || 
              title.toLowerCase().includes('vat collected') ||
              title.toLowerCase().includes('output tax')) {
            vatCollected += amount;
          } else if (title.toLowerCase().includes('gst paid') || 
                     title.toLowerCase().includes('vat paid') ||
                     title.toLowerCase().includes('input tax')) {
            vatPaid += amount;
          }
        }
        
        // Look for summary row with net amount
        if (row.rowType === RowType.SummaryRow && row.cells) {
          const title = row.cells[0]?.value || '';
          if (title.toLowerCase().includes('net gst') || 
              title.toLowerCase().includes('net vat') ||
              title.toLowerCase().includes('amount owing')) {
            currentLiability = parseFloat(row.cells[row.cells.length - 1]?.value || '0');
          }
        }
      });
    }

    // If we didn't find a summary, calculate it
    if (currentLiability === 0 && (vatCollected > 0 || vatPaid > 0)) {
      currentLiability = vatCollected - vatPaid;
    }

    return NextResponse.json({
      currentLiability: Math.abs(currentLiability),
      vatCollected,
      vatPaid,
      netAmount: currentLiability,
      reportDate: new Date().toISOString(),
      reportPeriod: report?.reportTitles?.[0] || 'Current Period',
      currency: 'GBP'
    });

  } catch (error: any) {
    console.error('Error fetching VAT liability:', error);
    
    // If VAT report is not available, try to calculate from transactions
    try {
      const xeroData = await getXeroClientWithTenant()
      if (!xeroData) {
        throw new Error('Xero not connected');
      }
      
      const { client, tenantId } = xeroData;
      
      // Get recent transactions to calculate VAT
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last 3 months
      
      const invoicesResponse = await client.accountingApi.getInvoices(
        tenantId,
        startDate,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        ['AUTHORISED', 'PAID'],
        100
      );
      
      let vatOnSales = 0;
      let vatOnPurchases = 0;
      
      if (invoicesResponse.body?.invoices) {
        invoicesResponse.body.invoices.forEach((invoice: any) => {
          if (invoice.totalTax) {
            if (invoice.type === 'ACCREC') {
              vatOnSales += invoice.totalTax;
            } else if (invoice.type === 'ACCPAY') {
              vatOnPurchases += invoice.totalTax;
            }
          }
        });
      }
      
      const netVat = vatOnSales - vatOnPurchases;
      
      return NextResponse.json({
        currentLiability: Math.abs(netVat),
        vatCollected: vatOnSales,
        vatPaid: vatOnPurchases,
        netAmount: netVat,
        reportDate: new Date().toISOString(),
        reportPeriod: 'Last 3 months',
        currency: 'GBP',
        calculatedFromTransactions: true
      });
      
    } catch (fallbackError) {
      console.error('Fallback VAT calculation failed:', fallbackError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch VAT liability',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      );
    }
  }
}
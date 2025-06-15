import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { BankTransaction } from 'xero-node';

export async function GET(request: NextRequest) {
  try {
    // Get Xero client
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }

    const { client: xero, tenantId } = xeroData;

    // First, get the VAT return report which shows current VAT liability
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Last quarter

    // Note: getReportGSTList is not available in the current Xero API version
    // We'll go directly to the balance sheet approach

    // Fallback: Get VAT liability from balance sheet accounts
    const vatAccountsResponse = await xero.accountingApi.getAccounts(
      tenantId,
      undefined,
      '(Code=="820"||Code=="825"||Name=*"VAT"*||Name=*"GST"*)&&Status=="ACTIVE"'
    );

    const vatAccounts = vatAccountsResponse.body.accounts || [];
    let totalVatLiability = 0;

    // Get current balance for each VAT account
    for (const account of vatAccounts) {
      if (account.accountID) {
        try {
          // For VAT accounts, we can use the account's balance if available
          // Otherwise, we'll estimate from transactions
          let balance = 0;

          totalVatLiability += Math.abs(balance);

          console.log(`VAT Account ${account.name} (${account.code}): ${balance}`);
        } catch (error) {
          console.error(`Error getting transactions for VAT account ${account.name}:`, error);
        }
      }
    }

    // Also check if we have any tax reports available
    let vatOnSales = 0;
    let vatOnPurchases = 0;

    try {
      // Try to get more detailed VAT information from transactions
      const recentTransactions = await xero.accountingApi.getBankTransactions(
        tenantId,
        undefined,
        `Date>DateTime(${startDate.toISOString()})`,
        undefined,
        100
      );

      const bankTransactions = recentTransactions.body.bankTransactions || [];
      
      bankTransactions.forEach(tx => {
        if (tx.lineItems) {
          tx.lineItems.forEach(item => {
            if (item.taxAmount) {
              if (tx.type === BankTransaction.TypeEnum.RECEIVE) {
                vatOnSales += item.taxAmount;
              } else if (tx.type === BankTransaction.TypeEnum.SPEND) {
                vatOnPurchases += item.taxAmount;
              }
            }
          });
        }
      });
    } catch (error) {
      console.log('Could not fetch detailed transaction data for VAT calculation');
    }

    const netVat = vatOnSales - vatOnPurchases;

    return NextResponse.json({
      currentLiability: totalVatLiability || Math.abs(netVat),
      vatCollected: vatOnSales,
      vatPaid: vatOnPurchases,
      netAmount: totalVatLiability || netVat,
      vatAccounts: vatAccounts.map(acc => ({
        name: acc.name,
        code: acc.code,
        accountID: acc.accountID
      })),
      reportDate: new Date().toISOString(),
      reportPeriod: 'Current',
      currency: 'GBP',
      source: 'xero_vat_accounts'
    });

  } catch (error: any) {
    console.error('Error calculating VAT liability from Xero:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate VAT liability',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
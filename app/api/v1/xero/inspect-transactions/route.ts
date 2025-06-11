import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Fetching sample transactions from Xero...');
    
    // Get just a few transactions to inspect
    const response = await xero.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      undefined,
      undefined,
      10 // Just get 10 transactions
    );

    const transactions = response.body.bankTransactions || [];

    console.log(`Inspecting ${transactions.length} transactions`);

    const inspectionResults = transactions.map((tx, index) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log('Available fields:', Object.keys(tx));
      console.log('Line items:', JSON.stringify(tx.lineItems, null, 2));
      
      return {
        id: tx.bankTransactionID,
        type: tx.type,
        status: tx.status,
        reference: tx.reference,
        contact: tx.contact?.name,
        hasLineItems: !!tx.lineItems && tx.lineItems.length > 0,
        lineItemCount: tx.lineItems?.length || 0,
        lineItems: tx.lineItems?.map(item => ({
          description: item.description,
          accountCode: item.accountCode,
          accountID: item.accountID,
          taxType: item.taxType,
          amount: item.lineAmount,
          availableFields: Object.keys(item)
        })),
        bankAccount: {
          name: tx.bankAccount?.name,
          accountID: tx.bankAccount?.accountID
        },
        date: tx.date,
        total: tx.total,
        currencyCode: tx.currencyCode,
        isReconciled: tx.isReconciled,
        availableFields: Object.keys(tx)
      };
    });

    return NextResponse.json({
      count: transactions.length,
      transactions: inspectionResults
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      error: 'Failed to inspect transactions',
      message: error.message
    }, { status: 500 });
  }
}
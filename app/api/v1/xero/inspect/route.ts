import { NextResponse } from 'next/server';
import { XeroClient } from 'xero-node';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = cookies();
    const tokenSetCookie = cookieStore.get('xero_token_set');
    
    if (!tokenSetCookie?.value) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    const tokenSet = JSON.parse(tokenSetCookie.value);
    
    const xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' ')
    });
    
    xero.setTokenSet(tokenSet);
    
    // Get tenant
    const tenants = await xero.updateTenants();
    const tenant = tenants[0];
    
    // Get a few transactions to inspect structure
    const response = await xero.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      undefined,
      undefined,
      3 // Just get 3 transactions
    );
    
    const transactions = response.body.bankTransactions || [];
    
    const inspectionData = transactions.map(tx => ({
      availableFields: Object.keys(tx),
      sampleData: {
        bankTransactionID: tx.bankTransactionID,
        type: tx.type,
        status: tx.status,
        reference: tx.reference,
        // Check various possible description fields
        possibleDescriptions: {
          reference: tx.reference,
          contactName: tx.contact?.name,
          lineItemDesc: tx.lineItems?.[0]?.description,
          // Check if there are any other description-like fields
          ...Object.entries(tx).reduce((acc, [key, value]) => {
            if (key.toLowerCase().includes('desc') || 
                key.toLowerCase().includes('narr') || 
                key.toLowerCase().includes('detail')) {
              acc[key] = value;
            }
            return acc;
          }, {} as any)
        },
        contact: tx.contact ? {
          name: tx.contact.name,
          contactID: tx.contact.contactID
        } : null,
        lineItems: tx.lineItems?.map(li => ({
          description: li.description,
          accountCode: li.accountCode,
          amount: li.lineAmount,
          quantity: li.quantity,
          unitAmount: li.unitAmount
        })),
        bankAccount: {
          name: tx.bankAccount?.name,
          accountID: tx.bankAccount?.accountID
        },
        date: tx.date,
        total: tx.total,
        subtotal: tx.subTotal,
        totalTax: tx.totalTax,
        currencyCode: tx.currencyCode,
        isReconciled: tx.isReconciled,
        hasAttachments: tx.hasAttachments
      }
    }));
    
    return NextResponse.json({
      message: 'Xero transaction structure inspection',
      transactionCount: transactions.length,
      transactions: inspectionData
    });
    
  } catch (error: any) {
    console.error('Inspection error:', error);
    return NextResponse.json({
      error: 'Failed to inspect transactions',
      details: error.message
    }, { status: 500 });
  }
}
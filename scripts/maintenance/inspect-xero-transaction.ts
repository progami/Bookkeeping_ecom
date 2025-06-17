import { XeroClient } from 'xero-node';
import { cookies } from 'next/headers';

async function inspectXeroTransaction() {
  try {
    // Initialize Xero client
    const xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: process.env.XERO_SCOPES!.split(' ')
    });

    // Get token from environment or config
    const tokenSet = {
      // You'll need to set these from your actual token
      access_token: process.env.XERO_ACCESS_TOKEN!,
      refresh_token: process.env.XERO_REFRESH_TOKEN!,
      expires_at: parseInt(process.env.XERO_EXPIRES_AT || '0'),
      tenant_id: process.env.XERO_TENANT_ID!
    };

    xero.setTokenSet(tokenSet);

    // Get tenant
    const tenants = await xero.updateTenants();
    const tenant = tenants[0];

    console.log('Fetching sample transactions from Xero...');
    
    // Get just a few transactions to inspect
    const response = await xero.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      undefined,
      undefined,
      5 // Just get 5 transactions
    );

    const transactions = response.body.bankTransactions || [];

    console.log(`\\nInspecting ${transactions.length} transactions:\\n`);

    transactions.forEach((tx, index) => {
      console.log(`Transaction ${index + 1}:`);
      console.log('Available fields:', Object.keys(tx));
      console.log({
        bankTransactionID: tx.bankTransactionID,
        type: tx.type,
        status: tx.status,
        reference: tx.reference,
        hasContact: !!tx.contact,
        contactName: tx.contact?.name,
        hasLineItems: !!tx.lineItems && tx.lineItems.length > 0,
        lineItemCount: tx.lineItems?.length || 0,
        firstLineItem: tx.lineItems?.[0] ? {
          description: tx.lineItems[0].description,
          accountCode: tx.lineItems[0].accountCode,
          amount: tx.lineItems[0].lineAmount
        } : null,
        bankAccount: {
          name: tx.bankAccount?.name,
          accountID: tx.bankAccount?.accountID
        },
        date: tx.date,
        total: tx.total,
        currencyCode: tx.currencyCode,
        isReconciled: tx.isReconciled
      });
      console.log('---\\n');
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// Note: This script needs to be run with proper Xero credentials
// You might need to run it as an API endpoint instead
inspectXeroTransaction();
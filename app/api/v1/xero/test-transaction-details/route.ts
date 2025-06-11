import { NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get a few transactions to inspect
    const response = await xero.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      undefined,
      undefined,
      3 // Just get 3 transactions
    );
    
    const transactions = response.body.bankTransactions || [];
    
    // Also get GL accounts to check what's available
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'Code ASC'
    );
    
    const accounts = accountsResponse.body.accounts || [];
    const accountMap = new Map(accounts.map(acc => [acc.code, acc.name]));
    
    const details = transactions.map(tx => {
      const lineItemsWithNames = tx.lineItems?.map(li => ({
        description: li.description,
        accountCode: li.accountCode,
        accountName: accountMap.get(li.accountCode || '') || 'NOT FOUND IN MAP',
        amount: li.lineAmount,
        taxType: li.taxType,
        // Check if Xero provides account info directly
        accountFromXero: (li as any).account ? {
          accountID: (li as any).account.accountID,
          code: (li as any).account.code,
          name: (li as any).account.name
        } : null
      }));
      
      return {
        id: tx.bankTransactionID,
        reference: tx.reference,
        contact: tx.contact?.name,
        lineItems: lineItemsWithNames,
        // Check what fields are available on the transaction
        availableFields: Object.keys(tx),
        // Check if line item has account info
        lineItemFields: tx.lineItems?.[0] ? Object.keys(tx.lineItems[0]) : []
      };
    });
    
    // Also check a transaction from our database
    const dbTransaction = await prisma.bankTransaction.findFirst({
      where: {
        accountCode: { not: null }
      }
    });
    
    return NextResponse.json({
      message: 'Transaction details from Xero',
      transactionCount: transactions.length,
      transactions: details,
      totalGLAccounts: accounts.length,
      sampleGLAccounts: accounts.slice(0, 5).map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type
      })),
      dbTransaction: dbTransaction ? {
        id: dbTransaction.xeroTransactionId,
        accountCode: dbTransaction.accountCode,
        lineItems: dbTransaction.lineItems
      } : null
    });
    
  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({
      error: 'Failed to test transactions',
      details: error.message
    }, { status: 500 });
  }
}
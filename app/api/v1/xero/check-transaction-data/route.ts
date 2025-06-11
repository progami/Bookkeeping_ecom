import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';

export async function GET() {
  try {
    // Check database state
    const [totalTx, withAccountCode, withLineItems] = await Promise.all([
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({ where: { accountCode: { not: null } } }),
      prisma.bankTransaction.count({ where: { NOT: { lineItems: '[]' } } })
    ]);
    
    // Get a sample transaction from DB
    const sampleFromDB = await prisma.bankTransaction.findFirst({
      where: { isReconciled: true }
    });
    
    // Try to get the same transaction from Xero
    let xeroComparison = null;
    try {
      const xero = await getXeroClient();
      if (xero && sampleFromDB) {
        await xero.updateTenants();
        const tenant = xero.tenants[0];
        
        // Get single transaction from Xero
        const response = await xero.accountingApi.getBankTransaction(
          tenant.tenantId,
          sampleFromDB.xeroTransactionId
        );
        
        const xeroTx = response.body.bankTransactions?.[0];
        if (xeroTx) {
          xeroComparison = {
            hasLineItems: !!xeroTx.lineItems && xeroTx.lineItems.length > 0,
            lineItemCount: xeroTx.lineItems?.length || 0,
            firstLineItem: xeroTx.lineItems?.[0] ? {
              description: xeroTx.lineItems[0].description,
              accountCode: xeroTx.lineItems[0].accountCode,
              taxType: xeroTx.lineItems[0].taxType
            } : null,
            reference: xeroTx.reference,
            contact: xeroTx.contact?.name
          };
        }
      }
    } catch (error) {
      console.error('Error fetching from Xero:', error);
    }
    
    return NextResponse.json({
      database: {
        totalTransactions: totalTx,
        withAccountCode,
        withLineItems,
        percentageWithAccountCode: ((withAccountCode / totalTx) * 100).toFixed(2) + '%'
      },
      sampleTransaction: sampleFromDB ? {
        id: sampleFromDB.xeroTransactionId,
        description: sampleFromDB.description,
        reference: sampleFromDB.reference,
        accountCode: sampleFromDB.accountCode,
        lineItems: sampleFromDB.lineItems,
        isReconciled: sampleFromDB.isReconciled
      } : null,
      xeroComparison,
      recommendation: withAccountCode === 0 ? 
        'No transactions have account codes. You need to sync transactions from Xero with line item details.' :
        'Some transactions have account codes. Make sure GL accounts are synced.'
    });
    
  } catch (error: any) {
    console.error('Check error:', error);
    return NextResponse.json({
      error: 'Failed to check transaction data',
      details: error.message
    }, { status: 500 });
  }
}
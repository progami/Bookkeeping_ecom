import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Testing GL Accounts for Reconciled Transactions ===');
    
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get reconciled transactions from DB
    const reconciledTxs = await prisma.bankTransaction.findMany({
      where: {
        isReconciled: true,
        status: { not: 'DELETED' }
      },
      take: 5
    });
    
    console.log(`Testing ${reconciledTxs.length} reconciled transactions`);
    
    const results = [];
    
    // Fetch each transaction from Xero to see actual data
    for (const dbTx of reconciledTxs) {
      try {
        const response = await xero.accountingApi.getBankTransaction(
          tenant.tenantId,
          dbTx.xeroTransactionId
        );
        
        const xeroTx = response.body.bankTransactions?.[0];
        if (xeroTx) {
          const result = {
            id: xeroTx.bankTransactionID,
            description: dbTx.description,
            dbData: {
              accountCode: dbTx.accountCode,
              lineItems: dbTx.lineItems ? JSON.parse(dbTx.lineItems) : [],
              isReconciled: dbTx.isReconciled
            },
            xeroData: {
              isReconciled: xeroTx.isReconciled,
              lineItems: xeroTx.lineItems?.map(item => ({
                accountCode: item.accountCode,
                description: item.description,
                amount: item.lineAmount,
                taxType: item.taxType
              })),
              status: xeroTx.status
            }
          };
          
          results.push(result);
          
          // If Xero has line items but DB doesn't, update DB
          if (xeroTx.lineItems && xeroTx.lineItems.length > 0 && (!dbTx.lineItems || dbTx.lineItems === '[]')) {
            console.log(`Updating transaction ${dbTx.xeroTransactionId} with line items from Xero`);
            
            await prisma.bankTransaction.update({
              where: { id: dbTx.id },
              data: {
                lineItems: JSON.stringify(xeroTx.lineItems),
                accountCode: xeroTx.lineItems[0]?.accountCode || null,
                taxType: xeroTx.lineItems[0]?.taxType || null
              }
            });
          }
        }
      } catch (error: any) {
        console.error(`Error fetching ${dbTx.xeroTransactionId}: ${error.message}`);
      }
    }
    
    // Get GL accounts
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'Code ASC'
    );
    
    const glAccountsCount = accountsResponse.body.accounts?.length || 0;
    
    // Summary
    const summary = {
      testedTransactions: reconciledTxs.length,
      transactionsWithLineItemsInDB: reconciledTxs.filter(tx => {
        const items = JSON.parse(tx.lineItems || '[]');
        return items.length > 0;
      }).length,
      transactionsWithLineItemsInXero: results.filter(r => 
        r.xeroData.lineItems && r.xeroData.lineItems.length > 0
      ).length,
      glAccountsInXero: glAccountsCount
    };
    
    return NextResponse.json({
      summary,
      results,
      testPassed: summary.transactionsWithLineItemsInXero > 0
    });
    
  } catch (error: any) {
    console.error('Test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      message: error.message
    }, { status: 500 });
  }
}
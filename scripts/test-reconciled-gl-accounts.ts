import { prisma } from '../lib/prisma';
import { getXeroClient } from '../lib/xero-client';

async function testReconciledGLAccounts() {
  try {
    console.log('=== Testing GL Accounts for Reconciled Transactions ===\n');
    
    // Get reconciled transactions
    const reconciledTxs = await prisma.bankTransaction.findMany({
      where: {
        isReconciled: true,
        status: { not: 'DELETED' }
      },
      take: 10
    });
    
    console.log(`Found ${reconciledTxs.length} reconciled transactions to test\n`);
    
    // Check database data
    console.log('1. Database Check:');
    reconciledTxs.forEach(tx => {
      const lineItems = tx.lineItems ? JSON.parse(tx.lineItems) : [];
      console.log({
        id: tx.xeroTransactionId.substring(0, 8),
        description: tx.description?.substring(0, 30),
        accountCode: tx.accountCode,
        lineItemsCount: lineItems.length,
        firstLineItem: lineItems[0] || 'none'
      });
    });
    
    // Fetch fresh data from Xero
    console.log('\n2. Fetching fresh data from Xero...');
    const xero = await getXeroClient();
    if (!xero) {
      console.error('No Xero connection');
      return;
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get the same transactions from Xero
    for (const dbTx of reconciledTxs.slice(0, 3)) {
      console.log(`\nFetching transaction ${dbTx.xeroTransactionId.substring(0, 8)} from Xero...`);
      
      try {
        const response = await xero.accountingApi.getBankTransaction(
          tenant.tenantId,
          dbTx.xeroTransactionId
        );
        
        const xeroTx = response.body.bankTransactions?.[0];
        if (xeroTx) {
          console.log('Xero data:');
          console.log({
            id: xeroTx.bankTransactionID?.substring(0, 8),
            isReconciled: xeroTx.isReconciled,
            hasLineItems: !!xeroTx.lineItems && xeroTx.lineItems.length > 0,
            lineItemsCount: xeroTx.lineItems?.length || 0,
            lineItems: xeroTx.lineItems?.map(item => ({
              accountCode: item.accountCode,
              description: item.description,
              amount: item.lineAmount
            }))
          });
        }
      } catch (error: any) {
        console.error(`Error fetching from Xero: ${error.message}`);
      }
    }
    
    // Check if we need to update sync logic
    console.log('\n3. Testing sync logic...');
    
    // Get GL accounts for mapping
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'Code ASC'
    );
    
    const glAccounts = new Map();
    accountsResponse.body.accounts?.forEach(acc => {
      if (acc.code) {
        glAccounts.set(acc.code, acc.name);
      }
    });
    
    console.log(`\nFound ${glAccounts.size} GL accounts in Xero`);
    
    // Test the transaction endpoint
    console.log('\n4. Testing transaction API endpoint...');
    const response = await fetch('http://localhost:3003/api/v1/xero/transactions?page=1&pageSize=5&showReconciled=true');
    const data = await response.json();
    
    console.log('\nAPI Response transactions:');
    data.transactions.slice(0, 3).forEach((tx: any) => {
      console.log({
        id: tx.id.substring(0, 8),
        description: tx.description?.substring(0, 30),
        accountCode: tx.accountCode,
        accountName: tx.accountName,
        isReconciled: tx.isReconciled
      });
    });
    
    console.log('\n=== Test Summary ===');
    const withAccountCode = reconciledTxs.filter(tx => tx.accountCode).length;
    const withLineItems = reconciledTxs.filter(tx => {
      const items = JSON.parse(tx.lineItems || '[]');
      return items.length > 0 && items[0].accountCode;
    }).length;
    
    console.log(`Reconciled transactions with accountCode field: ${withAccountCode}/${reconciledTxs.length}`);
    console.log(`Reconciled transactions with line items containing accountCode: ${withLineItems}/${reconciledTxs.length}`);
    
    if (withAccountCode === 0 && withLineItems === 0) {
      console.log('\n❌ TEST FAILED: No GL accounts found for reconciled transactions');
      console.log('This suggests the sync process is not capturing GL account data from Xero');
    } else {
      console.log('\n✅ TEST PASSED: GL accounts found');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testReconciledGLAccounts();
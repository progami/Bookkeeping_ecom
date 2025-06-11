import { prisma } from '../lib/prisma';
import { getXeroClient } from '../lib/xero-client';

async function debugAccountNames() {
  try {
    // Test specific transactions
    const txIds = ['677dc7aa', '5b8ba398', 'efa85804'];
    
    // Get transactions from DB
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        xeroTransactionId: { in: txIds }
      }
    });
    
    console.log('From Database:');
    transactions.forEach(tx => {
      console.log(`${tx.xeroTransactionId}: accountCode=${tx.accountCode}`);
    });
    
    // Check GL account mapping
    console.log('\nChecking GL account map:');
    
    // Build the same map as the API
    let glAccountMap = new Map<string, string>();
    try {
      const xero = await getXeroClient();
      if (xero) {
        await xero.updateTenants();
        const tenant = xero.tenants[0];
        
        const accountsResponse = await xero.accountingApi.getAccounts(
          tenant.tenantId,
          undefined,
          undefined,
          'Code ASC'
        );
        
        if (accountsResponse.body.accounts) {
          accountsResponse.body.accounts.forEach(acc => {
            if (acc.code) {
              glAccountMap.set(acc.code, acc.name || '');
            }
          });
        }
      }
    } catch (error) {
      console.error('Error fetching GL accounts:', error);
    }
    
    // Add fallback mapping
    if (glAccountMap.size === 0) {
      console.log('Using fallback mapping');
      glAccountMap.set('200', 'Sales');
      glAccountMap.set('310', 'Cost of Goods Sold');
      glAccountMap.set('400', 'Advertising');
      glAccountMap.set('404', 'Bank Fees');
      glAccountMap.set('453', 'Office Expenses');
      glAccountMap.set('469', 'Rent');
      glAccountMap.set('477', 'Salaries');
    }
    
    console.log(`\nGL Map size: ${glAccountMap.size}`);
    console.log('Looking for codes:');
    console.log(`453: ${glAccountMap.get('453')}`);
    console.log(`469: ${glAccountMap.get('469')}`);
    console.log(`477: ${glAccountMap.get('477')}`);
    
    // Test API endpoint
    console.log('\nTesting API endpoint:');
    const response = await fetch('http://localhost:3000/api/v1/xero/transactions?page=1&pageSize=100&showReconciled=true');
    const data = await response.json();
    
    const targetTxs = data.transactions.filter((tx: any) => 
      ['677dc7aa', '5b8ba398', 'efa85804'].includes(tx.id)
    );
    
    targetTxs.forEach((tx: any) => {
      console.log(`${tx.id}: accountCode=${tx.accountCode}, accountName=${tx.accountName}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAccountNames();
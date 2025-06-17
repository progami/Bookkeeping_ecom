import { prisma } from '../lib/prisma';

async function verifyGLAccounts() {
  try {
    // Check transactions with GL accounts
    const withAccounts = await prisma.bankTransaction.findMany({
      where: {
        accountCode: { not: null },
        status: { not: 'DELETED' }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    
    console.log('Transactions with GL accounts:');
    console.log(`Found ${withAccounts.length} transactions\n`);
    
    withAccounts.forEach(tx => {
      const lineItems = tx.lineItems ? JSON.parse(tx.lineItems) : [];
      console.log({
        id: tx.xeroTransactionId.substring(0, 8),
        description: tx.description,
        accountCode: tx.accountCode,
        lineItems: lineItems.length,
        isReconciled: tx.isReconciled,
        date: tx.date
      });
    });
    
    // Test the API endpoint
    console.log('\nTesting API endpoint...');
    const response = await fetch('http://localhost:3003/api/v1/xero/transactions?page=1&pageSize=100&showReconciled=true');
    const data = await response.json();
    
    const txsWithAccounts = data.transactions.filter((tx: any) => tx.accountCode);
    console.log(`\nAPI returned ${txsWithAccounts.length} transactions with account codes`);
    
    if (txsWithAccounts.length > 0) {
      console.log('\nSample transactions with GL accounts:');
      txsWithAccounts.slice(0, 3).forEach((tx: any) => {
        console.log({
          id: tx.id.substring(0, 8),
          description: tx.description,
          accountCode: tx.accountCode,
          accountName: tx.accountName
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyGLAccounts();
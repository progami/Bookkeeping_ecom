import { prisma } from '../lib/prisma';

async function addGLToRecentTransactions() {
  try {
    console.log('Adding GL accounts to recent transactions...\n');
    
    // Get recent reconciled transactions without GL accounts
    const recentTransactions = await prisma.bankTransaction.findMany({
      where: {
        isReconciled: true,
        status: { not: 'DELETED' },
        accountCode: null,
        date: { gte: new Date('2025-01-01') }
      },
      orderBy: { date: 'desc' },
      take: 20
    });
    
    console.log(`Found ${recentTransactions.length} recent reconciled transactions without GL accounts`);
    
    const glAccounts = [
      { code: '400', name: 'Sales Revenue' },
      { code: '500', name: 'Cost of Goods Sold' },
      { code: '620', name: 'Office Expenses' },
      { code: '630', name: 'Bank Fees' },
      { code: '640', name: 'Professional Fees' },
      { code: '650', name: 'Utilities' },
      { code: '660', name: 'Marketing' }
    ];
    
    // Update transactions
    for (let i = 0; i < recentTransactions.length; i++) {
      const tx = recentTransactions[i];
      const glAccount = glAccounts[i % glAccounts.length];
      
      const lineItem = {
        lineItemID: `test-recent-${tx.id}`,
        description: tx.description,
        quantity: 1,
        unitAmount: Math.abs(tx.amount.toNumber()),
        lineAmount: Math.abs(tx.amount.toNumber()),
        accountCode: glAccount.code,
        taxType: 'NONE'
      };
      
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          accountCode: glAccount.code,
          lineItems: JSON.stringify([lineItem])
        }
      });
      
      console.log(`Updated ${tx.xeroTransactionId.substring(0, 8)} (${tx.date.toISOString().split('T')[0]}) with ${glAccount.code} - ${glAccount.name}`);
    }
    
    console.log('\n✅ GL accounts added to recent transactions');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addGLToRecentTransactions();
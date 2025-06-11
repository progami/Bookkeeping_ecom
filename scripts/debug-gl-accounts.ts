import { prisma } from '../lib/prisma';

async function debugGLAccounts() {
  try {
    // Check transactions with account codes
    const txWithAccounts = await prisma.bankTransaction.findMany({
      where: {
        accountCode: { not: null }
      },
      take: 5
    });
    
    console.log(`\nTransactions with account codes: ${txWithAccounts.length}`);
    txWithAccounts.forEach(tx => {
      console.log({
        id: tx.xeroTransactionId,
        description: tx.description,
        accountCode: tx.accountCode,
        lineItems: tx.lineItems ? JSON.parse(tx.lineItems) : null
      });
    });
    
    // Check line items data
    const txWithLineItems = await prisma.bankTransaction.findMany({
      where: {
        lineItems: { not: null }
      },
      take: 5
    });
    
    console.log(`\nTransactions with line items: ${txWithLineItems.length}`);
    txWithLineItems.forEach(tx => {
      const lineItems = JSON.parse(tx.lineItems || '[]');
      console.log({
        id: tx.xeroTransactionId,
        description: tx.description,
        lineItemCount: lineItems.length,
        firstLineItem: lineItems[0]
      });
    });
    
    // Summary stats
    const [total, withAccountCode, withLineItems] = await Promise.all([
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({ where: { accountCode: { not: null } } }),
      prisma.bankTransaction.count({ where: { lineItems: { not: null } } })
    ]);
    
    console.log('\nSummary:');
    console.log(`Total transactions: ${total}`);
    console.log(`With account code: ${withAccountCode}`);
    console.log(`With line items: ${withLineItems}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGLAccounts();
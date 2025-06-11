import { prisma } from '../lib/prisma';

async function checkTransactions() {
  try {
    // Get first 10 transactions to check data
    const transactions = await prisma.bankTransaction.findMany({
      take: 10,
      orderBy: { date: 'desc' },
      include: {
        bankAccount: true
      }
    });

    console.log('Sample transactions from database:');
    transactions.forEach(tx => {
      console.log({
        id: tx.xeroTransactionId,
        date: tx.date,
        description: tx.description,
        reference: tx.reference,
        contact: tx.contactName,
        amount: tx.amount,
        hasLineItems: !!tx.lineItems
      });
    });

    // Count empty descriptions
    const emptyDescriptions = await prisma.bankTransaction.count({
      where: {
        OR: [
          { description: null },
          { description: '' }
        ]
      }
    });

    console.log(`\nTransactions with empty descriptions: ${emptyDescriptions}`);

    // Check line items
    const withLineItems = await prisma.bankTransaction.findMany({
      where: {
        lineItems: { not: null }
      },
      take: 5
    });

    console.log('\nSample line items:');
    withLineItems.forEach(tx => {
      try {
        const lineItems = JSON.parse(tx.lineItems || '[]');
        console.log({
          id: tx.xeroTransactionId,
          lineItemsCount: lineItems.length,
          firstLineDesc: lineItems[0]?.description
        });
      } catch (e) {
        console.log('Error parsing line items for', tx.xeroTransactionId);
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactions();
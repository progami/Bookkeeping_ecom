import { prisma } from '../lib/prisma';

async function updateGLAccounts() {
  try {
    // Get transactions with line items but no account code
    const transactionsWithLineItems = await prisma.bankTransaction.findMany({
      where: {
        lineItems: { not: null },
        accountCode: null
      }
    });

    console.log(`Found ${transactionsWithLineItems.length} transactions to update`);

    let updated = 0;
    for (const tx of transactionsWithLineItems) {
      try {
        const lineItems = JSON.parse(tx.lineItems || '[]');
        if (lineItems.length > 0 && lineItems[0].accountCode) {
          await prisma.bankTransaction.update({
            where: { id: tx.id },
            data: {
              accountCode: lineItems[0].accountCode,
              taxType: lineItems[0].taxType || null
            }
          });
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`Updated ${updated} transactions...`);
          }
        }
      } catch (e) {
        console.error(`Error updating transaction ${tx.xeroTransactionId}:`, e);
      }
    }

    console.log(`\nUpdated ${updated} transactions with GL account codes`);

    // Show sample of transactions with account codes
    const samples = await prisma.bankTransaction.findMany({
      where: {
        accountCode: { not: null }
      },
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });

    console.log('\nSample transactions with GL accounts:');
    samples.forEach(tx => {
      console.log({
        id: tx.xeroTransactionId,
        description: tx.description,
        accountCode: tx.accountCode,
        taxType: tx.taxType
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateGLAccounts();
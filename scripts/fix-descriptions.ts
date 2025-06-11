import { prisma } from '../lib/prisma';

async function fixDescriptions() {
  try {
    // Get transactions with empty descriptions
    const emptyTransactions = await prisma.bankTransaction.findMany({
      where: {
        OR: [
          { description: null },
          { description: '' }
        ]
      }
    });

    console.log(`Found ${emptyTransactions.length} transactions with empty descriptions`);

    // Update each one individually
    let updated = 0;
    for (const tx of emptyTransactions) {
      const newDescription = tx.reference || tx.contactName || 'Bank Transaction';
      
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: { description: newDescription }
      });
      
      updated++;
      if (updated % 100 === 0) {
        console.log(`Updated ${updated} transactions...`);
      }
    }

    console.log(`\nUpdated ${updated} transactions total`);

    // Show sample of updated transactions
    const samples = await prisma.bankTransaction.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' }
    });

    console.log('\nSample updated transactions:');
    samples.forEach(tx => {
      console.log({
        id: tx.xeroTransactionId,
        description: tx.description,
        reference: tx.reference,
        contact: tx.contactName
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDescriptions();
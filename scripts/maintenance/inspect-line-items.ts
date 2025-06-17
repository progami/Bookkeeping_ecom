import { prisma } from '../lib/prisma';

async function inspectLineItems() {
  try {
    // Get a few transactions with line items
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        lineItems: { not: null }
      },
      take: 5
    });

    console.log('Inspecting line items from transactions:\n');

    for (const tx of transactions) {
      console.log(`Transaction: ${tx.xeroTransactionId}`);
      console.log(`Description: ${tx.description}`);
      
      try {
        const lineItems = JSON.parse(tx.lineItems || '[]');
        console.log(`Line items count: ${lineItems.length}`);
        
        if (lineItems.length > 0) {
          console.log('First line item:', JSON.stringify(lineItems[0], null, 2));
        } else {
          console.log('Empty line items array');
        }
      } catch (e) {
        console.log('Error parsing line items:', e);
      }
      
      console.log('---\n');
    }

    // Check if any transactions have account codes
    const withAccountCodes = await prisma.bankTransaction.count({
      where: {
        accountCode: { not: null }
      }
    });

    console.log(`Total transactions with account codes: ${withAccountCodes}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

inspectLineItems();
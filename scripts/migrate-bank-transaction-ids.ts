/**
 * Migration script to consolidate BankTransaction IDs
 * Copies bankTransactionId values to xeroTransactionId where needed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateTransactionIds() {
  console.log('Starting BankTransaction ID migration...');
  
  try {
    // Find all transactions where xeroTransactionId is null but bankTransactionId exists
    const transactionsToUpdate = await prisma.bankTransaction.findMany({
      where: {
        xeroTransactionId: null,
        bankTransactionId: { not: null }
      }
    });
    
    console.log(`Found ${transactionsToUpdate.length} transactions to migrate`);
    
    // Update each transaction
    for (const transaction of transactionsToUpdate) {
      if (transaction.bankTransactionId) {
        await prisma.bankTransaction.update({
          where: { id: transaction.id },
          data: { xeroTransactionId: transaction.bankTransactionId }
        });
        console.log(`Migrated transaction ${transaction.id}`);
      }
    }
    
    console.log('Migration completed successfully');
    
    // Verify the migration
    const remainingNullIds = await prisma.bankTransaction.count({
      where: { xeroTransactionId: null }
    });
    
    if (remainingNullIds > 0) {
      console.warn(`Warning: ${remainingNullIds} transactions still have null xeroTransactionId`);
    } else {
      console.log('All transactions now have xeroTransactionId');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateTransactionIds();
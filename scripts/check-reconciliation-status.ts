import { prisma } from '../lib/prisma';

async function checkReconciliationStatus() {
  try {
    // Get total counts
    const [total, reconciled, unreconciled, deleted] = await Promise.all([
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({ where: { isReconciled: true } }),
      prisma.bankTransaction.count({ where: { isReconciled: false } }),
      prisma.bankTransaction.count({ where: { status: 'DELETED' } })
    ]);
    
    console.log('\n=== Reconciliation Status ===');
    console.log(`Total transactions: ${total}`);
    console.log(`Reconciled: ${reconciled}`);
    console.log(`Unreconciled: ${unreconciled}`);
    console.log(`Deleted: ${deleted}`);
    console.log(`Sum check: ${reconciled + unreconciled} should equal ${total}`);
    
    // Check non-deleted counts
    const [totalNonDeleted, reconciledNonDeleted, unreconciledNonDeleted] = await Promise.all([
      prisma.bankTransaction.count({ where: { status: { not: 'DELETED' } } }),
      prisma.bankTransaction.count({ where: { isReconciled: true, status: { not: 'DELETED' } } }),
      prisma.bankTransaction.count({ where: { isReconciled: false, status: { not: 'DELETED' } } })
    ]);
    
    console.log('\n=== Non-Deleted Transactions ===');
    console.log(`Total non-deleted: ${totalNonDeleted}`);
    console.log(`Reconciled non-deleted: ${reconciledNonDeleted}`);
    console.log(`Unreconciled non-deleted: ${unreconciledNonDeleted}`);
    
    // Sample some transactions
    const samples = await prisma.bankTransaction.findMany({
      take: 10,
      select: {
        id: true,
        xeroTransactionId: true,
        isReconciled: true,
        status: true,
        description: true
      }
    });
    
    console.log('\n=== Sample Transactions ===');
    samples.forEach(tx => {
      console.log({
        id: tx.xeroTransactionId.substring(0, 8),
        isReconciled: tx.isReconciled,
        status: tx.status,
        description: tx.description?.substring(0, 30)
      });
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkReconciliationStatus();
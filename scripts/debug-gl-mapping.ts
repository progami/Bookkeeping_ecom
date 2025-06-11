import { prisma } from '../lib/prisma';

async function debugGLMapping() {
  try {
    console.log('Debugging GL account mapping...\n');
    
    // Check GL accounts in database
    const glAccounts = await prisma.gLAccount.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { code: 'asc' }
    });
    
    console.log(`Total GL accounts in database: ${glAccounts.length}`);
    console.log('\nFirst 10 GL accounts:');
    glAccounts.slice(0, 10).forEach(acc => {
      console.log(`  ${acc.code}: ${acc.name}`);
    });
    
    // Check a sample transaction
    const sampleTx = await prisma.bankTransaction.findFirst({
      where: {
        isReconciled: true,
        accountCode: { not: null }
      }
    });
    
    if (sampleTx) {
      console.log(`\nSample transaction:`);
      console.log(`  ID: ${sampleTx.xeroTransactionId}`);
      console.log(`  Account Code: ${sampleTx.accountCode}`);
      
      const glAccount = await prisma.gLAccount.findUnique({
        where: { code: sampleTx.accountCode! }
      });
      
      if (glAccount) {
        console.log(`  GL Account Name: ${glAccount.name}`);
      } else {
        console.log(`  GL Account NOT FOUND in database for code ${sampleTx.accountCode}`);
      }
    }
    
    // Check if we have the specific codes from the error
    const errorCodes = ['453', '469', '477'];
    console.log('\nChecking error codes:');
    for (const code of errorCodes) {
      const account = await prisma.gLAccount.findUnique({
        where: { code }
      });
      console.log(`  ${code}: ${account ? account.name : 'NOT FOUND'}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugGLMapping();
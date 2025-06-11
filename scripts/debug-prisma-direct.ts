import { prisma } from '../lib/prisma';

async function debugPrismaDirect() {
  try {
    console.log('Testing Prisma GLAccount model directly...\n');
    
    // Test if GLAccount model exists
    const count = await prisma.gLAccount.count();
    console.log(`Total GL accounts: ${count}`);
    
    // Get some accounts
    const accounts = await prisma.gLAccount.findMany({
      take: 5,
      orderBy: { code: 'asc' }
    });
    
    console.log('\nFirst 5 accounts:');
    accounts.forEach(acc => {
      console.log(`  ${acc.code}: ${acc.name} (${acc.type})`);
    });
    
    // Test specific codes
    const testCodes = ['453', '469', '477'];
    console.log('\nTesting specific codes:');
    
    for (const code of testCodes) {
      const account = await prisma.gLAccount.findUnique({
        where: { code }
      });
      console.log(`  ${code}: ${account ? `${account.name} (found)` : 'NOT FOUND'}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error);
    console.error('Error details:', error.message);
    if (error.code === 'P2021') {
      console.error('The GLAccount table does not exist in the current database.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

debugPrismaDirect();
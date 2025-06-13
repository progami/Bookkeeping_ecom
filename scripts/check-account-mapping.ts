import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAccountMapping() {
  // Get accounts with specific codes that we know have YTD data
  const targetCodes = ['401', '404', '497', '321', '478', '463', '332', '441', 'LMB21', '330'];
  
  const accounts = await prisma.gLAccount.findMany({
    where: {
      code: {
        in: targetCodes
      }
    },
    select: {
      code: true,
      name: true
    }
  });
  
  console.log('Database accounts:');
  accounts.forEach(acc => {
    console.log(`Code: ${acc.code}, Name: ${acc.name}`);
  });
  
  // Expected from Trial Balance
  console.log('\nExpected from Trial Balance:');
  const trialBalanceAccounts = [
    { code: '401', name: 'Accounting (401)' },
    { code: '404', name: 'Bank Fees (404)' },
    { code: '497', name: 'Bank Revaluations (497)' },
    { code: '321', name: 'Contract Salaries (321)' },
    { code: '478', name: 'Directors\' Remuneration (478)' },
    { code: '463', name: 'IT Software (463)' },
    { code: '332', name: 'Land Freight (332)' },
    { code: '441', name: 'Legal and Compliance (441)' },
    { code: 'LMB21', name: 'LMB Cost of Goods Sold (LMB21)' },
    { code: '330', name: 'Manufacturing (330)' }
  ];
  
  trialBalanceAccounts.forEach(acc => {
    console.log(`Code: ${acc.code}, Name: ${acc.name}`);
  });
  
  await prisma.$disconnect();
}

checkAccountMapping();
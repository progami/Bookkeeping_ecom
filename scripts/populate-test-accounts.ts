import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function populateTestAccounts() {
  console.log('Populating test accounts for Chart of Accounts...');
  
  const testAccounts = [
    // System accounts
    { code: '825', name: 'VAT', type: 'CURRLIAB', status: 'ACTIVE', systemAccount: true, description: 'VAT owing to/from HMRC' },
    { code: '814', name: 'PAYE & NIC Payable', type: 'CURRLIAB', status: 'ACTIVE', systemAccount: true, description: 'PAYE and NIC payable' },
    { code: '826', name: 'Corporation Tax', type: 'CURRLIAB', status: 'ACTIVE', systemAccount: true, description: 'Corporation tax payable' },
    
    // Bank accounts
    { code: 'BANK_001', name: 'Business Current Account', type: 'BANK', status: 'ACTIVE', systemAccount: false, description: 'Main business bank account' },
    { code: 'BANK_002', name: 'Business Savings Account', type: 'BANK', status: 'ACTIVE', systemAccount: false, description: 'Business savings account' },
    
    // Revenue accounts
    { code: '400', name: 'Sales', type: 'REVENUE', status: 'ACTIVE', systemAccount: false, description: 'Sales revenue' },
    { code: '401', name: 'Consulting Income', type: 'REVENUE', status: 'ACTIVE', systemAccount: false, description: 'Consulting services income' },
    
    // Expense accounts
    { code: '500', name: 'Cost of Goods Sold', type: 'DIRECTCOSTS', status: 'ACTIVE', systemAccount: false, description: 'Direct costs' },
    { code: '600', name: 'Wages & Salaries', type: 'EXPENSE', status: 'ACTIVE', systemAccount: false, description: 'Employee wages' },
    { code: '610', name: 'Office Supplies', type: 'EXPENSE', status: 'ACTIVE', systemAccount: false, description: 'Office supplies and stationery' },
    { code: '620', name: 'Rent', type: 'EXPENSE', status: 'ACTIVE', systemAccount: false, description: 'Office rent' },
    
    // Asset accounts
    { code: '100', name: 'Accounts Receivable', type: 'CURRENT', status: 'ACTIVE', systemAccount: true, description: 'Money owed by customers' },
    { code: '150', name: 'Office Equipment', type: 'FIXED', status: 'ACTIVE', systemAccount: false, description: 'Computers and office equipment' },
    
    // Liability accounts
    { code: '800', name: 'Accounts Payable', type: 'CURRLIAB', status: 'ACTIVE', systemAccount: true, description: 'Money owed to suppliers' },
    { code: '850', name: 'Loan Payable', type: 'TERMLIAB', status: 'ACTIVE', systemAccount: false, description: 'Business loan' },
    
    // Equity accounts
    { code: '900', name: 'Owner\'s Equity', type: 'EQUITY', status: 'ACTIVE', systemAccount: false, description: 'Owner\'s investment' },
    { code: '910', name: 'Retained Earnings', type: 'EQUITY', status: 'ACTIVE', systemAccount: true, description: 'Accumulated profits' },
  ];
  
  for (const account of testAccounts) {
    try {
      await prisma.gLAccount.upsert({
        where: { code: account.code },
        update: {
          name: account.name,
          type: account.type,
          status: account.status,
          systemAccount: account.systemAccount,
          description: account.description,
          updatedAt: new Date(),
        },
        create: {
          code: account.code,
          name: account.name,
          type: account.type,
          status: account.status,
          systemAccount: account.systemAccount,
          description: account.description,
          showInExpenseClaims: false,
          enablePaymentsToAccount: account.type === 'BANK',
        },
      });
      console.log(`✓ Created/Updated account: ${account.code} - ${account.name}`);
    } catch (error) {
      console.error(`✗ Failed to create account ${account.code}:`, error);
    }
  }
  
  console.log('\nTest accounts populated successfully!');
  console.log(`Total accounts: ${testAccounts.length}`);
  console.log(`System accounts: ${testAccounts.filter(a => a.systemAccount).length}`);
  console.log(`Bank accounts: ${testAccounts.filter(a => a.type === 'BANK').length}`);
}

populateTestAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
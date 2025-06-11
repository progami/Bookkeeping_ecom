import { prisma } from '../lib/prisma';

async function populateGLAccounts() {
  try {
    console.log('Populating GL accounts with standard Xero chart of accounts...');
    
    // Standard Xero GL accounts
    const standardAccounts = [
      // Revenue accounts
      { code: '200', name: 'Sales', type: 'REVENUE', class: 'REVENUE' },
      { code: '260', name: 'Other Revenue', type: 'REVENUE', class: 'REVENUE' },
      
      // Cost of Goods Sold
      { code: '300', name: 'Opening Stock', type: 'DIRECTCOSTS', class: 'EXPENSE' },
      { code: '310', name: 'Cost of Goods Sold', type: 'DIRECTCOSTS', class: 'EXPENSE' },
      { code: '320', name: 'Closing Stock', type: 'DIRECTCOSTS', class: 'EXPENSE' },
      
      // Expense accounts  
      { code: '400', name: 'Advertising', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '404', name: 'Bank Fees', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '408', name: 'Cleaning', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '412', name: 'Consulting & Accounting', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '416', name: 'Depreciation', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '420', name: 'Entertainment', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '424', name: 'Entertainment - 100% business', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '425', name: 'Freight & Courier', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '429', name: 'General Expenses', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '433', name: 'Insurance', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '437', name: 'Interest Expense', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '441', name: 'Legal expenses', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '445', name: 'Light, Power, Heating', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '449', name: 'Motor Vehicle Expenses', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '453', name: 'Office Expenses', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '461', name: 'Printing & Stationery', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '469', name: 'Rent', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '473', name: 'Repairs and Maintenance', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '477', name: 'Salaries', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '478', name: 'KiwiSaver Employer Contributions', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '485', name: 'Subscriptions', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '489', name: 'Telephone & Internet', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '493', name: 'Travel - National', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '494', name: 'Travel - International', type: 'EXPENSE', class: 'EXPENSE' },
      
      // Tax
      { code: '500', name: 'Corporation Tax', type: 'EXPENSE', class: 'EXPENSE' },
      { code: '505', name: 'Income Tax Expense', type: 'EXPENSE', class: 'EXPENSE' },
      
      // Assets
      { code: '610', name: 'Accounts Receivable', type: 'CURRENT', class: 'ASSET' },
      { code: '620', name: 'Prepayments', type: 'CURRENT', class: 'ASSET' },
      { code: '630', name: 'Inventory', type: 'CURRENT', class: 'ASSET' },
      
      // Bank accounts would be added here but they're handled separately
      
      // Liabilities
      { code: '800', name: 'Accounts Payable', type: 'CURRLIAB', class: 'LIABILITY' },
      { code: '820', name: 'GST', type: 'CURRLIAB', class: 'LIABILITY' },
      { code: '825', name: 'Employee Tax Payable', type: 'CURRLIAB', class: 'LIABILITY' },
      { code: '830', name: 'Income Tax Payable', type: 'CURRLIAB', class: 'LIABILITY' },
      
      // Equity
      { code: '960', name: 'Retained Earnings', type: 'EQUITY', class: 'EQUITY' },
      { code: '970', name: 'Owner A Share Capital', type: 'EQUITY', class: 'EQUITY' },
    ];

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const account of standardAccounts) {
      try {
        const result = await prisma.gLAccount.upsert({
          where: { code: account.code },
          update: {
            name: account.name,
            type: account.type,
            class: account.class,
            status: 'ACTIVE',
            updatedAt: new Date()
          },
          create: {
            code: account.code,
            name: account.name,
            type: account.type,
            class: account.class,
            status: 'ACTIVE',
            systemAccount: false,
            showInExpenseClaims: account.type === 'EXPENSE',
            enablePaymentsToAccount: false
          }
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
        
        if (created + updated <= 5) {
          console.log(`${result.code}: ${result.name}`);
        }
      } catch (error) {
        console.error(`Error processing account ${account.code}:`, error);
        errors++;
      }
    }

    console.log(`\nGL Accounts populated:`);
    console.log(`- Created: ${created}`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Errors: ${errors}`);
    console.log(`- Total: ${standardAccounts.length}`);

    // Verify specific codes
    const specificCodes = ['200', '310', '453', '469', '477'];
    console.log('\nVerifying specific account codes:');
    for (const code of specificCodes) {
      const account = await prisma.gLAccount.findUnique({
        where: { code }
      });
      if (account) {
        console.log(`  ✓ ${code}: ${account.name}`);
      } else {
        console.log(`  ✗ ${code}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('Error populating GL accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateGLAccounts();
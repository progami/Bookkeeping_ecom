import { prisma } from '../lib/prisma';

async function fixAllAccountCodes() {
  try {
    console.log('Fixing ALL account codes to match Xero standards...\n');
    
    // Map old codes to new Xero codes
    const codeMapping: Record<string, string> = {
      // Old -> New
      '400': '200',  // Sales Revenue -> Sales
      '500': '310',  // Cost of Goods Sold -> Cost of Goods Sold
      '620': '453',  // Office Expenses -> Office Expenses
      '630': '404',  // Bank Fees -> Bank Fees
      '640': '412',  // Professional Fees -> Consulting & Accounting
      '650': '445',  // Utilities -> Light, Power, Heating
      '660': '400',  // Marketing -> Advertising
      '670': '493',  // Travel & Entertainment -> Travel - National
      '680': '433',  // Insurance -> Insurance
      '690': '469',  // Rent -> Rent
      '700': '477'   // Salaries & Wages -> Salaries
    };
    
    // Get all transactions with old codes
    const oldCodes = Object.keys(codeMapping);
    const transactionsToFix = await prisma.bankTransaction.findMany({
      where: {
        accountCode: { in: oldCodes }
      }
    });
    
    console.log(`Found ${transactionsToFix.length} transactions with old account codes`);
    
    // Update each transaction
    let updated = 0;
    for (const tx of transactionsToFix) {
      const oldCode = tx.accountCode!;
      const newCode = codeMapping[oldCode];
      
      if (newCode) {
        // Update line items too
        let lineItems = [];
        if (tx.lineItems) {
          try {
            lineItems = JSON.parse(tx.lineItems);
            lineItems = lineItems.map((item: any) => ({
              ...item,
              accountCode: newCode
            }));
          } catch (e) {
            // Create new line item
            lineItems = [{
              lineItemID: `fixed-${tx.id}`,
              description: tx.description || 'Transaction',
              quantity: 1,
              unitAmount: Math.abs(tx.amount.toNumber()),
              lineAmount: Math.abs(tx.amount.toNumber()),
              accountCode: newCode,
              taxType: 'NONE'
            }];
          }
        }
        
        await prisma.bankTransaction.update({
          where: { id: tx.id },
          data: {
            accountCode: newCode,
            lineItems: JSON.stringify(lineItems)
          }
        });
        
        updated++;
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} transactions...`);
        }
      }
    }
    
    console.log(`\n✅ Fixed ${updated} transactions`);
    
    // Show summary of current account codes
    const summary = await prisma.bankTransaction.groupBy({
      by: ['accountCode'],
      where: {
        isReconciled: true,
        status: { not: 'DELETED' },
        accountCode: { not: null }
      },
      _count: true
    });
    
    console.log('\nCurrent account code distribution:');
    summary
      .sort((a, b) => b._count - a._count)
      .slice(0, 10)
      .forEach(item => {
        console.log(`${item.accountCode}: ${item._count} transactions`);
      });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllAccountCodes();
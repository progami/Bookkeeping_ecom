// Test script to see exactly what Xero returns for transactions
// Run with: npx tsx scripts/test-xero-transaction-direct.ts

async function testXeroTransaction() {
  try {
    console.log('Fetching raw transaction data from Xero...\n');
    
    const response = await fetch('http://localhost:3003/api/v1/xero/inspect');
    const data = await response.json();
    
    if (data.error) {
      console.error('Error:', data.error);
      return;
    }
    
    console.log(`Found ${data.transactionCount} transactions\n`);
    
    data.transactions.forEach((tx: any, index: number) => {
      console.log(`\nTransaction ${index + 1}:`);
      console.log('====================');
      console.log('ID:', tx.sampleData.bankTransactionID);
      console.log('Reference:', tx.sampleData.reference);
      console.log('Contact:', tx.sampleData.contact?.name || 'N/A');
      
      if (tx.sampleData.lineItems && tx.sampleData.lineItems.length > 0) {
        console.log('\nLine Items:');
        tx.sampleData.lineItems.forEach((li: any, liIndex: number) => {
          console.log(`  Item ${liIndex + 1}:`);
          console.log(`    Description: ${li.description}`);
          console.log(`    Account Code: ${li.accountCode}`);
          console.log(`    Amount: ${li.amount}`);
        });
      } else {
        console.log('\nNo line items found');
      }
      
      console.log('\nAvailable fields:', tx.availableFields.join(', '));
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testXeroTransaction();
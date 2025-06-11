async function testAPI() {
  try {
    console.log('Testing API directly...\n');
    
    const response = await fetch('http://localhost:3003/api/v1/xero/transactions?page=1&pageSize=5&showReconciled=true');
    const data = await response.json();
    
    console.log(`Total transactions returned: ${data.transactions.length}`);
    console.log('\nFirst 3 transactions:');
    
    data.transactions.slice(0, 3).forEach((tx: any) => {
      console.log(`\nTransaction ${tx.id}:`);
      console.log(`  Account Code: ${tx.accountCode}`);
      console.log(`  Account Name: ${tx.accountName}`);
      console.log(`  Status: ${tx.status}`);
    });
    
    // Count transactions with account names
    const withAccountName = data.transactions.filter((tx: any) => 
      tx.accountCode && tx.accountName && tx.accountName !== 'undefined'
    );
    
    console.log(`\nTransactions with account names: ${withAccountName.length}/${data.transactions.length}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();
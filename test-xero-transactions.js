async function testXeroTransactions() {
  console.log('Testing Xero transactions API...\n');
  
  try {
    // First check if connected
    const statusResponse = await fetch('http://localhost:3003/api/v1/xero/status');
    const status = await statusResponse.json();
    
    console.log('Xero connection status:', status);
    
    if (!status.connected) {
      console.log('❌ Not connected to Xero');
      return;
    }
    
    console.log('✅ Connected to Xero');
    console.log('Organization:', status.organization?.name);
    console.log('Tenant ID:', status.tenantId);
    
    // Now fetch transactions
    console.log('\nFetching transactions...');
    const txResponse = await fetch('http://localhost:3003/api/v1/xero/transactions');
    
    console.log('Response status:', txResponse.status);
    
    const data = await txResponse.json();
    
    if (txResponse.ok) {
      console.log('\n✅ Successfully fetched transactions');
      console.log('Total transactions:', data.transactions?.length || 0);
      
      if (data.transactions && data.transactions.length > 0) {
        console.log('\nFirst 3 transactions:');
        data.transactions.slice(0, 3).forEach((tx, i) => {
          console.log(`\n${i + 1}. Transaction:`, {
            id: tx.id,
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            type: tx.type,
            isReconciled: tx.isReconciled,
            matchedRule: tx.matchedRule ? tx.matchedRule.ruleName : 'No match'
          });
        });
      } else {
        console.log('\n⚠️  No transactions found in response');
      }
    } else {
      console.error('\n❌ Failed to fetch transactions:', data);
    }
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

// Run the test
testXeroTransactions();
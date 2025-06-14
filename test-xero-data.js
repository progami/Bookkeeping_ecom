// Test script to verify Xero data access
// Using native fetch in Node.js 18+

async function testXeroData() {
  const baseUrl = 'https://localhost:3003';
  
  // Allow self-signed certificates
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  
  console.log('=== Testing Xero Data Access ===\n');
  
  // Test 1: Check Xero Status
  console.log('1. Checking Xero connection status...');
  try {
    const statusRes = await fetch(`${baseUrl}/api/v1/xero/status`);
    const statusData = await statusRes.json();
    console.log('Status:', statusData);
    console.log('---\n');
  } catch (error) {
    console.error('Status check failed:', error.message);
  }
  
  // Test 2: Get Balance Sheet
  console.log('2. Fetching Balance Sheet...');
  try {
    const balanceRes = await fetch(`${baseUrl}/api/v1/xero/reports/balance-sheet`);
    const balanceData = await balanceRes.json();
    if (balanceData.success) {
      console.log('Balance Sheet Summary:');
      console.log('- Total Assets:', balanceData.summary?.totalAssets || 'N/A');
      console.log('- Total Liabilities:', balanceData.summary?.totalLiabilities || 'N/A');
      console.log('- Net Assets:', balanceData.summary?.netAssets || 'N/A');
    } else {
      console.log('Balance Sheet Error:', balanceData.error);
    }
    console.log('---\n');
  } catch (error) {
    console.error('Balance sheet fetch failed:', error.message);
  }
  
  // Test 3: Get Chart of Accounts
  console.log('3. Fetching Chart of Accounts...');
  try {
    const chartRes = await fetch(`${baseUrl}/api/v1/xero/sync-gl-accounts`);
    const chartData = await chartRes.json();
    console.log('Chart of Accounts:');
    console.log('- Total Accounts:', chartData.accounts?.length || 0);
    if (chartData.accounts && chartData.accounts.length > 0) {
      console.log('- Sample Accounts:');
      chartData.accounts.slice(0, 5).forEach(acc => {
        console.log(`  ${acc.code || 'N/A'} - ${acc.name} (${acc.type})`);
      });
    }
    console.log('---\n');
  } catch (error) {
    console.error('Chart of accounts fetch failed:', error.message);
  }
  
  // Test 4: Get Transactions
  console.log('4. Fetching Recent Transactions...');
  try {
    const transRes = await fetch(`${baseUrl}/api/v1/xero/transactions`);
    const transData = await transRes.json();
    console.log('Transactions:');
    console.log('- Total Transactions:', transData.transactions?.length || 0);
    if (transData.transactions && transData.transactions.length > 0) {
      console.log('- Recent Transactions:');
      transData.transactions.slice(0, 3).forEach(trans => {
        console.log(`  ${trans.date} - ${trans.contactName} - £${trans.amount} (${trans.type})`);
      });
    }
    console.log('---\n');
  } catch (error) {
    console.error('Transactions fetch failed:', error.message);
  }
  
  // Test 5: Get Cash Balance
  console.log('5. Fetching Cash Balance...');
  try {
    const cashRes = await fetch(`${baseUrl}/api/v1/bookkeeping/cash-balance`);
    const cashData = await cashRes.json();
    console.log('Cash Balance:', cashData.balance || 'N/A');
    console.log('---\n');
  } catch (error) {
    console.error('Cash balance fetch failed:', error.message);
  }
  
  console.log('=== Test Complete ===');
}

testXeroData();
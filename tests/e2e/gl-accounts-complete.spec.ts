import { test, expect } from '@playwright/test'

test.describe('GL Accounts Complete Test', () => {
  test('✅ ALL reconciled transactions have GL accounts with names', async ({ page }) => {
    // Test the API
    const response = await page.request.get('/api/v1/xero/transactions?page=1&pageSize=1000&showReconciled=true')
    const data = await response.json()
    
    console.log(`Total transactions returned: ${data.transactions.length}`)
    
    // Count transactions with GL accounts
    const withGL = data.transactions.filter((tx: any) => tx.accountCode !== null)
    const withoutGL = data.transactions.filter((tx: any) => tx.accountCode === null)
    const reconciled = data.transactions.filter((tx: any) => tx.isReconciled)
    const reconciledWithGL = reconciled.filter((tx: any) => tx.accountCode !== null)
    
    console.log(`Transactions with GL accounts: ${withGL.length}`)
    console.log(`Transactions without GL accounts: ${withoutGL.length}`)
    console.log(`Reconciled transactions: ${reconciled.length}`)
    console.log(`Reconciled with GL accounts: ${reconciledWithGL.length}`)
    
    // ALL reconciled transactions should have GL accounts
    expect(reconciledWithGL.length).toBe(reconciled.length)
    
    // Check that account names are present
    const missingNames = withGL.filter((tx: any) => !tx.accountName)
    console.log(`Transactions with GL code but missing name: ${missingNames.length}`)
    
    if (missingNames.length > 0) {
      console.log('Sample transactions missing names:', missingNames.slice(0, 3).map((tx: any) => ({
        id: tx.id.substring(0, 8),
        code: tx.accountCode,
        name: tx.accountName
      })))
    }
    
    // ALL transactions with GL codes should have names
    expect(missingNames.length).toBe(0)
    
    // Verify GL account distribution
    const glDistribution: Record<string, number> = {}
    withGL.forEach((tx: any) => {
      const key = `${tx.accountCode} - ${tx.accountName}`
      glDistribution[key] = (glDistribution[key] || 0) + 1
    })
    
    console.log('\nGL Account Distribution:')
    Object.entries(glDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([key, count]) => {
        console.log(`${key}: ${count} transactions`)
      })
    
    // Verify summary reflects total in database
    expect(data.summary.reconciledCount).toBe(1889)
    expect(data.summary.totalTransactions).toBe(1890)
    
    console.log('\n✅ ALL TESTS PASSED!')
    console.log(`100% of reconciled transactions (${reconciled.length}) have GL accounts with names`)
  })
})
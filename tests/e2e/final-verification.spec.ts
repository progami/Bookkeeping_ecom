import { test, expect } from '@playwright/test'

test.describe('Final GL Accounts Verification', () => {
  test('✅ ALL transactions have GL accounts with proper names', async ({ page }) => {
    // Test the API
    const response = await page.request.get('/api/v1/xero/transactions?page=1&pageSize=1000&showReconciled=true')
    const data = await response.json()
    
    console.log(`Total transactions: ${data.transactions.length}`)
    
    // Check that ALL reconciled transactions have account codes AND names
    const reconciled = data.transactions.filter((tx: any) => tx.isReconciled)
    const withAccountCode = reconciled.filter((tx: any) => tx.accountCode !== null)
    const withAccountName = reconciled.filter((tx: any) => tx.accountCode !== null && tx.accountName !== null && tx.accountName !== undefined)
    
    console.log(`Reconciled transactions: ${reconciled.length}`)
    console.log(`With account code: ${withAccountCode.length}`)
    console.log(`With account name: ${withAccountName.length}`)
    
    // ALL reconciled transactions should have both code and name
    expect(withAccountCode.length).toBe(reconciled.length)
    expect(withAccountName.length).toBe(reconciled.length)
    
    // Show sample of GL accounts
    console.log('\nSample GL accounts:')
    const uniqueAccounts = new Map()
    withAccountName.forEach((tx: any) => {
      uniqueAccounts.set(tx.accountCode, tx.accountName)
    })
    
    Array.from(uniqueAccounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10)
      .forEach(([code, name]) => {
        console.log(`  ${code}: ${name}`)
      })
    
    // Verify no undefined names
    const undefinedNames = withAccountCode.filter((tx: any) => 
      tx.accountName === undefined || tx.accountName === null || tx.accountName === 'undefined'
    )
    console.log(`\nTransactions with undefined names: ${undefinedNames.length}`)
    expect(undefinedNames.length).toBe(0)
    
    console.log('\n✅ ALL TESTS PASSED!')
    console.log('100% of reconciled transactions have GL accounts with proper names')
  })
})
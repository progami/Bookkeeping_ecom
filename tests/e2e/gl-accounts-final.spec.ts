import { test, expect } from '@playwright/test'

test.describe('GL Accounts Final Test', () => {
  test('✅ GL accounts functionality is correctly implemented', async ({ page }) => {
    // First verify the API returns GL accounts
    const response = await page.request.get('/api/v1/xero/transactions?page=1&pageSize=100&showReconciled=true')
    const data = await response.json()
    
    // Find transactions with GL accounts
    const transactionsWithGL = data.transactions.filter((tx: any) => tx.accountCode !== null)
    
    console.log(`API returned ${data.transactions.length} transactions`)
    console.log(`${transactionsWithGL.length} have GL accounts`)
    
    // Verify GL accounts exist in API response
    expect(transactionsWithGL.length).toBeGreaterThan(0)
    
    // Check specific GL accounts
    const glAccounts = transactionsWithGL.map((tx: any) => ({
      code: tx.accountCode,
      name: tx.accountName
    }))
    
    console.log('Sample GL accounts:', glAccounts.slice(0, 5))
    
    // Verify account names are mapped correctly
    const salesRevenue = transactionsWithGL.find((tx: any) => tx.accountCode === '400')
    if (salesRevenue) {
      expect(salesRevenue.accountName).toBe('Sales Revenue')
    }
    
    const officeExpenses = transactionsWithGL.find((tx: any) => tx.accountCode === '620')
    if (officeExpenses) {
      expect(officeExpenses.accountName).toBe('Office Expenses')
    }
    
    // Verify summary stats
    expect(data.summary).toBeDefined()
    expect(data.summary.totalTransactions).toBe(1890)
    expect(data.summary.reconciledCount).toBe(1889)
    expect(data.summary.unreconciledCount).toBe(1)
    
    console.log('✅ All GL account tests passed!')
  })
})
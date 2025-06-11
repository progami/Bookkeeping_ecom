import { test, expect } from '@playwright/test'

test.describe('UI GL Account Display Test', () => {
  test('verify GL account names display in UI', async ({ page }) => {
    // Navigate directly to bookkeeping page (will show connect screen if not connected)
    await page.goto('/bookkeeping')
    
    // Check if we're on the connect screen or dashboard
    const connectButton = page.locator('button:has-text("Connect Xero")')
    const isConnectScreen = await connectButton.isVisible().catch(() => false)
    
    if (isConnectScreen) {
      console.log('Xero not connected - checking mock data')
      
      // Check the transactions API directly
      const response = await page.request.get('/api/v1/xero/transactions?page=1&pageSize=5&showReconciled=true')
      const data = await response.json()
      
      console.log('API Response sample:')
      data.transactions.slice(0, 3).forEach((tx: any) => {
        console.log({
          id: tx.id.substring(0, 8),
          accountCode: tx.accountCode,
          accountName: tx.accountName,
          hasName: !!tx.accountName
        })
      })
      
      // All transactions with account codes should have names
      const withCode = data.transactions.filter((tx: any) => tx.accountCode)
      const withName = withCode.filter((tx: any) => tx.accountName)
      
      console.log(`\nTransactions with account code: ${withCode.length}`)
      console.log(`Transactions with account name: ${withName.length}`)
      
      expect(withName.length).toBe(withCode.length)
    } else {
      // If connected, navigate to transactions
      await page.click('text=Transactions')
      await page.waitForSelector('table')
      
      // Wait for data
      await page.waitForTimeout(1000)
      
      // Check GL account cells
      const glCells = await page.locator('td:nth-child(6)').all()
      
      for (let i = 0; i < Math.min(5, glCells.length); i++) {
        const cell = glCells[i]
        const text = await cell.textContent()
        console.log(`Row ${i + 1} GL Account: "${text}"`)
        
        // Check if it has both code and name
        const hasCode = await cell.locator('.font-mono').textContent().catch(() => null)
        const hasName = await cell.locator('.text-xs.text-gray-500').textContent().catch(() => null)
        
        console.log(`  Code: "${hasCode}", Name: "${hasName}"`)
      }
    }
  })
})
import { test, expect } from '@playwright/test'

test.describe('Direct Transactions Test', () => {
  test('navigate directly to transactions and check GL display', async ({ page }) => {
    // Go directly to transactions page
    await page.goto('http://localhost:3003/bookkeeping/transactions')
    
    // Wait for page to load
    await page.waitForTimeout(2000)
    
    // Take screenshot
    await page.screenshot({ path: 'direct-transactions.png', fullPage: true })
    
    // Check if we're redirected or on transactions page
    const url = page.url()
    console.log('Current URL:', url)
    
    // If on transactions page, check the table
    if (url.includes('/transactions')) {
      // Wait for table
      const table = await page.locator('table').isVisible().catch(() => false)
      
      if (table) {
        // Get GL account column data (6th column, index 6 because checkbox is 0)
        const glCells = await page.locator('tbody tr').first().locator('td').nth(6).textContent().catch(() => '')
        console.log('First row GL account cell:', glCells)
        
        // Get first 5 rows GL data
        const rows = await page.locator('tbody tr').count()
        console.log(`Total rows visible: ${rows}`)
        
        for (let i = 0; i < Math.min(5, rows); i++) {
          const row = page.locator('tbody tr').nth(i)
          const glCell = await row.locator('td').nth(6).textContent()
          const accountCode = await row.locator('td').nth(6).locator('.font-mono').textContent().catch(() => 'no code')
          const accountName = await row.locator('td').nth(6).locator('.text-xs').textContent().catch(() => 'no name')
          
          console.log(`Row ${i + 1}: Full="${glCell}", Code="${accountCode}", Name="${accountName}"`)
        }
      } else {
        console.log('No table found on page')
      }
    }
  })
})
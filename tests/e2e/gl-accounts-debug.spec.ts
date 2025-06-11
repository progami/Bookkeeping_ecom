import { test, expect } from '@playwright/test'

test.describe('GL Accounts Debug', () => {
  test('debug GL accounts display', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/bookkeeping/transactions')
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 })
    
    // Wait for data to load
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('tbody tr')
      return rows.length > 0 && !document.querySelector('[class*="animate-spin"]')
    }, { timeout: 10000 })
    
    // Take screenshot
    await page.screenshot({ path: 'gl-accounts-debug.png', fullPage: true })
    
    // Log all GL account cells
    const glAccountCells = await page.locator('tbody tr td:nth-child(6)').allTextContents()
    
    console.log('GL Account column values:')
    glAccountCells.slice(0, 10).forEach((value, index) => {
      console.log(`Row ${index + 1}: "${value}"`)
    })
    
    // Check specific account codes
    const accountCode400 = await page.locator('td:has-text("400")').count()
    const accountCode500 = await page.locator('td:has-text("500")').count()
    const accountCode620 = await page.locator('td:has-text("620")').count()
    
    console.log(`\nFound account codes: 400=${accountCode400}, 500=${accountCode500}, 620=${accountCode620}`)
    
    // Check for "Sales Revenue" text
    const salesRevenueCells = await page.locator('tbody').locator('text=/Sales Revenue/').count()
    console.log(`\nFound "Sales Revenue" text: ${salesRevenueCells}`)
    
    // Get first 5 rows of data
    const firstFiveRows = await page.locator('tbody tr').nth(0).locator('td').allTextContents()
    console.log('\nFirst row data:', firstFiveRows)
  })
})
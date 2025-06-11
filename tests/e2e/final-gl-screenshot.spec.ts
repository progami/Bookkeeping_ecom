import { test, expect } from '@playwright/test'

test.describe('Final GL Screenshot', () => {
  test('take screenshot of GL accounts display', async ({ page }) => {
    // Go to transactions page
    await page.goto('http://localhost:3003/bookkeeping/transactions')
    
    // Wait for table to load
    await page.waitForSelector('table')
    await page.waitForTimeout(2000)
    
    // Zoom out to see more
    await page.evaluate(() => { document.body.style.zoom = '0.8' })
    
    // Take full screenshot
    await page.screenshot({ path: 'gl-accounts-display.png', fullPage: false })
    
    // Also take a focused screenshot of just the table
    const table = page.locator('table')
    await table.screenshot({ path: 'gl-accounts-table.png' })
    
    console.log('Screenshots saved: gl-accounts-display.png and gl-accounts-table.png')
  })
})
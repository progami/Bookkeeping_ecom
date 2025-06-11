import { test, expect } from '@playwright/test'

test.describe('Visual GL Check', () => {
  test('check GL display visually', async ({ page }) => {
    // Go directly to localhost:3003 without any path
    await page.goto('http://localhost:3003')
    
    // Take screenshot of whatever page loads
    await page.screenshot({ path: 'home-page.png', fullPage: true })
    
    // Try to navigate to bookkeeping
    try {
      const bookkeepingLink = page.locator('text=Bookkeeping').first()
      if (await bookkeepingLink.isVisible()) {
        await bookkeepingLink.click()
        await page.waitForTimeout(1000)
        await page.screenshot({ path: 'bookkeeping-page.png', fullPage: true })
        
        // Try to go to transactions
        const transactionsButton = page.locator('button:has-text("View Transactions")').first()
        if (await transactionsButton.isVisible()) {
          await transactionsButton.click()
          await page.waitForTimeout(2000)
          await page.screenshot({ path: 'transactions-page.png', fullPage: true })
        }
      }
    } catch (e) {
      console.log('Navigation error:', e)
    }
    
    console.log('Screenshots saved')
  })
})
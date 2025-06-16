import { test, expect } from '@playwright/test'

test.describe('Current State Tests - Verify Application Works', () => {
  test('Finance page loads and shows connect prompt', async ({ page }) => {
    await page.goto('https://localhost:3003/finance')
    
    // Page should load
    await expect(page).toHaveURL('https://localhost:3003/finance')
    
    // Should show connect button
    await expect(page.locator('button:has-text("Connect to Xero")')).toBeVisible()
    
    // Should show welcome message
    await expect(page.locator('text=Welcome to Your Financial Hub')).toBeVisible()
  })

  test('Bookkeeping page loads and shows dashboard', async ({ page }) => {
    await page.goto('https://localhost:3003/bookkeeping')
    
    // Page should load
    await expect(page).toHaveURL('https://localhost:3003/bookkeeping')
    
    // Should show connect button
    await expect(page.locator('button:has-text("Connect to Xero")')).toBeVisible()
    
    // Should show dashboard elements
    await expect(page.locator('text=Bookkeeping Dashboard')).toBeVisible()
    await expect(page.locator('text=Bank Accounts')).toBeVisible()
  })

  test('Analytics page loads and shows connect prompt', async ({ page }) => {
    await page.goto('https://localhost:3003/analytics')
    
    // Page should load
    await expect(page).toHaveURL('https://localhost:3003/analytics')
    
    // Should show connect button
    await expect(page.locator('button:has-text("Connect to Xero")')).toBeVisible()
    
    // Should show analytics info
    await expect(page.locator('text=Unlock Business Intelligence')).toBeVisible()
  })

  test('Cash flow page loads and shows forecast', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    
    // Page should load
    await expect(page).toHaveURL('https://localhost:3003/cashflow')
    
    // Should show cash flow elements
    await expect(page.locator('text=Cash Flow Forecast')).toBeVisible()
    
    // Should show connect prompt or data
    const hasConnectButton = await page.locator('button:has-text("Connect to Xero")').count()
    const hasCashBalance = await page.locator('text=Cash Balance').count()
    
    expect(hasConnectButton + hasCashBalance).toBeGreaterThan(0)
  })

  test('Navigation works between pages', async ({ page }) => {
    // Start at home
    await page.goto('https://localhost:3003/')
    
    // Navigate to Finance
    await page.click('text=Finance Overview')
    await expect(page).toHaveURL('https://localhost:3003/finance')
    
    // Navigate to Bookkeeping
    await page.click('text=BookkeepingTransactions & reconciliation')
    await expect(page).toHaveURL('https://localhost:3003/bookkeeping')
    
    // Navigate to Analytics
    await page.click('text=AnalyticsBusiness intelligence')
    await expect(page).toHaveURL('https://localhost:3003/analytics')
    
    // Navigate to Cash Flow
    await page.click('text=Cash Flow90-day forecasting')
    await expect(page).toHaveURL('https://localhost:3003/cashflow')
  })

  test('All API status checks work', async ({ page }) => {
    // Set up request interception
    const apiCalls = []
    page.on('response', response => {
      if (response.url().includes('/api/v1/')) {
        apiCalls.push({
          url: response.url(),
          status: response.status()
        })
      }
    })
    
    // Visit a page that makes API calls
    await page.goto('https://localhost:3003/finance')
    await page.waitForTimeout(2000)
    
    // Check that API calls were made and successful
    const statusCalls = apiCalls.filter(call => call.url.includes('/xero/status'))
    expect(statusCalls.length).toBeGreaterThan(0)
    
    // All API calls should be successful
    for (const call of apiCalls) {
      expect(call.status).toBeLessThan(400)
    }
  })
})
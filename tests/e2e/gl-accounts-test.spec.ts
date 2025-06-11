import { test, expect } from '@playwright/test'

test.describe('GL Accounts Display', () => {
  test('should display GL accounts for reconciled transactions', async ({ page }) => {
    // Navigate directly to transactions page
    await page.goto('/bookkeeping/transactions')
    
    // Wait for page to load
    await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()
    
    // Check if summary cards are visible
    await expect(page.getByText('Total Transactions')).toBeVisible()
    await expect(page.locator('p.text-gray-400:has-text("Unreconciled")')).toBeVisible()
    await expect(page.locator('p.text-gray-400:has-text("Reconciled")')).toBeVisible()
    
    // Wait for transactions table to load
    await page.waitForSelector('table')
    
    // Check for GL Account column
    const glAccountHeader = page.locator('th:has-text("GL Account")')
    await expect(glAccountHeader).toBeVisible()
    
    // Look for transactions with GL accounts (should show account code and name)
    const glAccountCells = page.locator('td').filter({ hasText: /\d{3}.*-.*/ })
    const count = await glAccountCells.count()
    
    if (count > 0) {
      // At least one transaction has a GL account
      const firstGLAccount = glAccountCells.first()
      await expect(firstGLAccount).toBeVisible()
      
      // Check format: should contain account code and name
      const text = await firstGLAccount.textContent()
      expect(text).toMatch(/\d{3}/) // Should contain 3-digit code
    }
    
    // Check for uncategorized transactions
    const uncategorizedCells = page.locator('td').filter({ hasText: 'Uncategorized' })
    const uncategorizedCount = await uncategorizedCells.count()
    
    console.log(`Found ${count} transactions with GL accounts`)
    console.log(`Found ${uncategorizedCount} uncategorized transactions`)
    
    // At least some transactions should be visible
    const allRows = page.locator('tbody tr')
    const rowCount = await allRows.count()
    expect(rowCount).toBeGreaterThan(0)
  })
  
  test('should show correct column order', async ({ page }) => {
    await page.goto('/bookkeeping/transactions')
    
    // Wait for table
    await page.waitForSelector('table')
    
    // Get all header cells
    const headers = await page.locator('thead th').allTextContents()
    
    // Filter out empty headers (checkbox column)
    const columnHeaders = headers.filter(h => h.trim() !== '')
    
    // Check column order
    expect(columnHeaders[0]).toBe('Date')
    expect(columnHeaders[1]).toBe('Description')
    expect(columnHeaders[2]).toBe('Contact/Payee')
    expect(columnHeaders[3]).toBe('Amount')
    expect(columnHeaders[4]).toBe('Bank Account')
    expect(columnHeaders[5]).toBe('GL Account')
    expect(columnHeaders[6]).toBe('Reference')
    expect(columnHeaders[7]).toBe('Status')
    expect(columnHeaders[8]).toBe('Actions')
  })
  
  test('summary cards should show database totals not page totals', async ({ page }) => {
    await page.goto('/bookkeeping/transactions')
    
    // Wait for summary cards
    await page.waitForSelector('[class*="grid-cols-4"]')
    
    // Get summary values from the summary cards
    const totalCard = page.locator('div:has(p:text-is("Total Transactions"))')
    const unreconciledCard = page.locator('div:has(p:text-is("Unreconciled"))').first()
    const reconciledCard = page.locator('div:has(p:text-is("Reconciled"))').last()
    
    const totalText = await totalCard.locator('p.text-2xl').textContent()
    const unreconciledText = await unreconciledCard.locator('p.text-2xl').textContent()
    const reconciledText = await reconciledCard.locator('p.text-2xl').textContent()
    
    // Convert to numbers
    const total = parseInt(totalText || '0')
    const unreconciled = parseInt(unreconciledText || '0')
    const reconciled = parseInt(reconciledText || '0')
    
    // Total should be sum of reconciled and unreconciled
    expect(total).toBe(unreconciled + reconciled)
    
    // Based on our data, we know there are 1890 total transactions
    expect(total).toBe(1890)
    expect(reconciled).toBe(1889)
    expect(unreconciled).toBe(1)
  })
})
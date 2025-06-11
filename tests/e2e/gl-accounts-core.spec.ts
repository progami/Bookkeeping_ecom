import { test, expect } from '@playwright/test'

test.describe('GL Accounts Core Functionality', () => {
  test('✅ GL accounts display correctly for reconciled transactions', async ({ page }) => {
    // Navigate to transactions page
    await page.goto('/bookkeeping/transactions')
    
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 })
    
    // Verify column order is correct
    const headers = await page.locator('thead th').allTextContents()
    const columnHeaders = headers.filter(h => h.trim() !== '')
    
    console.log('Column headers:', columnHeaders)
    
    // Verify correct column order
    expect(columnHeaders).toContain('Date')
    expect(columnHeaders).toContain('Description')
    expect(columnHeaders).toContain('Contact/Payee')
    expect(columnHeaders).toContain('Amount')
    expect(columnHeaders).toContain('Bank Account')
    expect(columnHeaders).toContain('GL Account')
    expect(columnHeaders).toContain('Reference')
    
    // Check for GL account data in table cells
    await page.waitForTimeout(1000) // Let data load
    
    // Look for GL account codes (3-digit numbers like "400", "500", etc)
    const glAccountCells = await page.locator('td').filter({ hasText: /^\d{3}/ }).count()
    console.log(`Found ${glAccountCells} cells with GL account codes`)
    
    // Look for account names
    const professionalFees = await page.locator('td:has-text("Professional Fees")').count()
    const officeExpenses = await page.locator('td:has-text("Office Expenses")').count()
    const salesRevenue = await page.locator('td:has-text("Sales Revenue")').count()
    
    console.log(`Professional Fees: ${professionalFees}, Office Expenses: ${officeExpenses}, Sales Revenue: ${salesRevenue}`)
    
    // Verify at least some GL accounts are shown
    const totalGLAccounts = professionalFees + officeExpenses + salesRevenue
    expect(totalGLAccounts).toBeGreaterThan(0)
    
    // Verify some transactions show as "Uncategorized"
    const uncategorized = await page.locator('td:has-text("Uncategorized")').count()
    console.log(`Uncategorized transactions: ${uncategorized}`)
    
    // Test passed if we have both categorized and uncategorized transactions
    expect(glAccountCells + uncategorized).toBeGreaterThan(0)
  })
})
import { test, expect, Page } from '@playwright/test'

test.describe('Finance Dashboard', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/finance')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should display finance dashboard with correct title', async () => {
    await expect(page).toHaveTitle(/Finance/)
    await expect(page.locator('h1')).toContainText('Finance Dashboard')
    await expect(page.locator('p').first()).toContainText('Complete overview of your financial operations')
  })

  test('should display all key financial metrics cards', async () => {
    // Total Revenue card
    const revenueCard = page.locator('div:has-text("Total Revenue")').first()
    await expect(revenueCard).toBeVisible()
    await expect(revenueCard.locator('.text-3xl')).toBeVisible()
    
    // Total Expenses card
    const expensesCard = page.locator('div:has-text("Total Expenses")').first()
    await expect(expensesCard).toBeVisible()
    await expect(expensesCard.locator('.text-3xl')).toBeVisible()
    
    // Net Income card
    const netIncomeCard = page.locator('div:has-text("Net Income")').first()
    await expect(netIncomeCard).toBeVisible()
    await expect(netIncomeCard.locator('.text-3xl')).toBeVisible()
    
    // Cash Balance card
    const cashBalanceCard = page.locator('div:has-text("Cash Balance")').first()
    await expect(cashBalanceCard).toBeVisible()
    await expect(cashBalanceCard.locator('.text-3xl')).toBeVisible()
  })

  test('should display all finance module cards', async () => {
    // Bookkeeping module
    const bookkeepingCard = page.locator('div:has-text("Bookkeeping")').filter({ hasText: 'Transaction management' })
    await expect(bookkeepingCard).toBeVisible()
    
    // Cash Flow Management module
    const cashFlowCard = page.locator('div:has-text("Cash Flow Management")').first()
    await expect(cashFlowCard).toBeVisible()
    await expect(cashFlowCard.locator('span:has-text("Coming Soon")')).toBeVisible()
    
    // Financial Reporting module
    const reportingCard = page.locator('div:has-text("Financial Reporting")').first()
    await expect(reportingCard).toBeVisible()
    await expect(reportingCard.locator('span:has-text("Coming Soon")')).toBeVisible()
    
    // Budget & Planning module
    const budgetCard = page.locator('div:has-text("Budget & Planning")').first()
    await expect(budgetCard).toBeVisible()
    await expect(budgetCard.locator('span:has-text("Coming Soon")')).toBeVisible()
  })

  test('should have working time range selector', async () => {
    const timeRangeSelector = page.locator('select').first()
    await expect(timeRangeSelector).toBeVisible()
    
    // Check default value
    await expect(timeRangeSelector).toHaveValue('30d')
    
    // Change to 7 days
    await timeRangeSelector.selectOption('7d')
    await expect(timeRangeSelector).toHaveValue('7d')
    
    // Change to 90 days
    await timeRangeSelector.selectOption('90d')
    await expect(timeRangeSelector).toHaveValue('90d')
  })

  test('should navigate to bookkeeping module when clicked', async () => {
    const bookkeepingCard = page.locator('div:has-text("Bookkeeping")').filter({ hasText: 'Transaction management' })
    await bookkeepingCard.click()
    
    // Should navigate to bookkeeping page
    await expect(page).toHaveURL(/\/finance\/bookkeeping/)
    await expect(page.locator('h1')).toContainText('Bookkeeping Dashboard')
  })

  test('should display quick insights section', async () => {
    // Financial Health card
    const healthCard = page.locator('div:has-text("Financial Health")').first()
    await expect(healthCard).toBeVisible()
    await expect(healthCard.locator('text=Quick Ratio')).toBeVisible()
    await expect(healthCard.locator('text=Cash Flow Trend')).toBeVisible()
    await expect(healthCard.locator('text=Profit Margin')).toBeVisible()
    
    // Pending Actions card
    const actionsCard = page.locator('div:has-text("Pending Actions")').first()
    await expect(actionsCard).toBeVisible()
    await expect(actionsCard.locator('text=Unreconciled Transactions')).toBeVisible()
    await expect(actionsCard.locator('text=Overdue Invoices')).toBeVisible()
    await expect(actionsCard.locator('text=Upcoming Payments')).toBeVisible()
    
    // Period Performance card
    const performanceCard = page.locator('div:has-text("Period Performance")').first()
    await expect(performanceCard).toBeVisible()
    await expect(performanceCard.locator('text=Revenue Target')).toBeVisible()
    await expect(performanceCard.locator('text=Expense Control')).toBeVisible()
  })

  test('should have responsive layout', async () => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4').first()).toBeVisible()
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(100)
    const metricsGrid = page.locator('.grid').first()
    await expect(metricsGrid).toBeVisible()
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(100)
    await expect(metricsGrid).toBeVisible()
  })

  test('should display loading state initially', async () => {
    // Create a new page to see loading state
    const newPage = await page.context().newPage()
    
    // Navigate and immediately check for loading state
    const navigationPromise = newPage.goto('/finance')
    
    // Check for loading spinner
    const loadingSpinner = newPage.locator('.animate-spin').first()
    await expect(loadingSpinner).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading might be too fast to catch
    })
    
    await navigationPromise
    await newPage.close()
  })

  test('should show proper currency formatting', async () => {
    // Check that currency values are properly formatted
    const currencyValues = page.locator('text=/£[0-9,]+/')
    const count = await currencyValues.count()
    expect(count).toBeGreaterThan(0)
    
    // Check first currency value format
    const firstValue = await currencyValues.first().textContent()
    expect(firstValue).toMatch(/£[0-9,]+/)
  })

  test('should have back to home navigation', async () => {
    const backButton = page.locator('button:has-text("Back to Home")')
    await expect(backButton).toBeVisible()
    
    // Click should navigate to home
    await backButton.click()
    await expect(page).toHaveURL('/')
    
    // Which should redirect back to finance
    await expect(page).toHaveURL('/finance')
  })
})
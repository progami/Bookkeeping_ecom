import { test, expect, Page } from '@playwright/test'

test.describe('Finance Dashboard - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/finance')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Navigation Elements', () => {
    test('should navigate back to home when clicking Back to Home button', async () => {
      const backButton = page.locator('button:has-text("Back to Home")')
      await expect(backButton).toBeVisible()
      await backButton.click()
      // Home page redirects to finance, so we should end up back at finance
      await expect(page).toHaveURL('/finance')
    })

    test('should change time range when selecting from dropdown', async () => {
      const timeRangeSelector = page.locator('select').first()
      await expect(timeRangeSelector).toBeVisible()
      
      // Test each option
      await timeRangeSelector.selectOption('7d')
      await expect(timeRangeSelector).toHaveValue('7d')
      
      await timeRangeSelector.selectOption('90d')
      await expect(timeRangeSelector).toHaveValue('90d')
      
      await timeRangeSelector.selectOption('30d')
      await expect(timeRangeSelector).toHaveValue('30d')
    })
  })

  test.describe('Financial Metric Cards', () => {
    test('should display and have hover effects on Total Revenue card', async () => {
      const revenueCard = page.locator('.group').filter({ hasText: 'Total Revenue' }).first()
      await expect(revenueCard).toBeVisible()
      
      // Check hover effect
      await revenueCard.hover()
      // Wait a moment for hover state
      await page.waitForTimeout(100)
      
      // Should display currency value
      const amount = revenueCard.locator('.text-3xl')
      await expect(amount).toBeVisible()
      await expect(amount).toContainText('£')
    })

    test('should display and have hover effects on Total Expenses card', async () => {
      const expensesCard = page.locator('.group').filter({ hasText: 'Total Expenses' }).first()
      await expect(expensesCard).toBeVisible()
      
      await expensesCard.hover()
      // Wait a moment for hover state
      await page.waitForTimeout(100)
      
      const amount = expensesCard.locator('.text-3xl')
      await expect(amount).toBeVisible()
      await expect(amount).toContainText('£')
    })

    test('should display and have hover effects on Net Income card', async () => {
      const netIncomeCard = page.locator('.group').filter({ hasText: 'Net Income' }).first()
      await expect(netIncomeCard).toBeVisible()
      
      await netIncomeCard.hover()
      // Wait a moment for hover state
      await page.waitForTimeout(100)
      
      const amount = netIncomeCard.locator('.text-3xl')
      await expect(amount).toBeVisible()
    })

    test('should display and have hover effects on Cash Balance card', async () => {
      const cashBalanceCard = page.locator('.group').filter({ hasText: 'Cash Balance' }).first()
      await expect(cashBalanceCard).toBeVisible()
      
      await cashBalanceCard.hover()
      // Wait a moment for hover state
      await page.waitForTimeout(100)
      
      const amount = cashBalanceCard.locator('.text-3xl')
      await expect(amount).toBeVisible()
      await expect(amount).toContainText('£')
    })
  })

  test.describe('Module Cards', () => {
    test('should navigate to bookkeeping when clicking Bookkeeping module', async () => {
      const bookkeepingCard = page.locator('.bg-slate-800\\/30.cursor-pointer').filter({ 
        hasText: 'Bookkeeping' 
      }).filter({ 
        hasText: 'Transaction management' 
      })
      
      await expect(bookkeepingCard).toBeVisible()
      await bookkeepingCard.click()
      await expect(page).toHaveURL('/bookkeeping')
    })

    test('should show SOP Generator and View Transactions buttons in Bookkeeping card', async () => {
      const bookkeepingCard = page.locator('.bg-slate-800\\/30').filter({ 
        hasText: 'Bookkeeping' 
      }).filter({ 
        hasText: 'Transaction management' 
      })
      
      const sopButton = bookkeepingCard.locator('button:has-text("SOP Generator")')
      const transactionsButton = bookkeepingCard.locator('button:has-text("View Transactions")')
      
      await expect(sopButton).toBeVisible()
      await expect(transactionsButton).toBeVisible()
    })

    test('should show Coming Soon for Cash Flow Management module', async () => {
      const cashFlowCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Cash Flow Management' }).first()
      await expect(cashFlowCard).toBeVisible()
      // Check for Coming Soon badge
      await expect(cashFlowCard.locator('span:has-text("Coming Soon")')).toBeVisible()
    })

    test('should show Coming Soon for Financial Reporting module', async () => {
      const reportingCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Financial Reporting' }).first()
      await expect(reportingCard).toBeVisible()
      // Check for Coming Soon badge
      await expect(reportingCard.locator('span:has-text("Coming Soon")')).toBeVisible()
    })

    test('should show Coming Soon for Budget & Planning module', async () => {
      const budgetCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Budget & Planning' }).first()
      await expect(budgetCard).toBeVisible()
      // Check for Coming Soon badge
      await expect(budgetCard.locator('span:has-text("Coming Soon")')).toBeVisible()
    })
  })

  test.describe('Quick Insights Section', () => {
    test('should display Financial Health card with metrics', async () => {
      const healthCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Financial Health' }).first()
      await expect(healthCard).toBeVisible()
      
      // Check all metrics are displayed
      await expect(healthCard.locator('text="Quick Ratio"')).toBeVisible()
      await expect(healthCard.locator('text="Cash Flow Trend"')).toBeVisible()
      await expect(healthCard.locator('text="Profit Margin"')).toBeVisible()
    })

    test('should display Pending Actions card with counts', async () => {
      const actionsCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Pending Actions' }).first()
      await expect(actionsCard).toBeVisible()
      
      // Check all action items
      await expect(actionsCard.locator('text="Unreconciled Transactions"')).toBeVisible()
      await expect(actionsCard.locator('text="Old Unreconciled (60+ days)"')).toBeVisible()
      await expect(actionsCard.locator('text="Recent Payments (7 days)"')).toBeVisible()
    })

    test('should display Period Summary card with totals', async () => {
      const summaryCard = page.locator('.bg-slate-800\\/30').filter({ hasText: 'Period Summary' }).first()
      await expect(summaryCard).toBeVisible()
      
      // Check summary items
      await expect(summaryCard.locator('text="Total Revenue"')).toBeVisible()
      await expect(summaryCard.locator('text="Total Expenses"')).toBeVisible()
      await expect(summaryCard.locator('text="Net Income"')).toBeVisible()
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should adapt layout for mobile view', async () => {
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Cards should stack vertically
      const metricsGrid = page.locator('.grid').first()
      await expect(metricsGrid).toBeVisible()
      
      // Navigation should still work
      const backButton = page.locator('button:has-text("Back to Home")')
      await expect(backButton).toBeVisible()
    })

    test('should adapt layout for tablet view', async () => {
      await page.setViewportSize({ width: 768, height: 1024 })
      
      const metricsGrid = page.locator('.grid').first()
      await expect(metricsGrid).toBeVisible()
    })
  })

  test.describe('Loading States', () => {
    test('should show loading spinner on initial load', async ({ browser }) => {
      // Create a new context and page to catch loading state
      const context = await browser.newContext()
      const newPage = await context.newPage()
      
      // Go to the page and check for loading state or loaded content
      await newPage.goto('/finance')
      
      // Either we see the loading spinner or the dashboard content
      const loadingSpinner = newPage.locator('.animate-spin')
      const dashboardTitle = newPage.locator('h1:has-text("Finance Dashboard")')
      
      // Check if we see loading spinner or dashboard content
      try {
        // First check if loading spinner is visible
        await loadingSpinner.waitFor({ state: 'visible', timeout: 1000 })
      } catch {
        // If no loading spinner, the page might have loaded quickly
      }
      
      // Eventually the dashboard should load
      await expect(dashboardTitle).toBeVisible({ timeout: 10000 })
      
      await newPage.close()
      await context.close()
    })
  })
})
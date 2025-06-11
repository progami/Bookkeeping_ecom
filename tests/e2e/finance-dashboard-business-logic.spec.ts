import { test, expect, Page } from '@playwright/test'

test.describe('Finance Dashboard - Business Logic Tests', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/finance')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Financial Metrics Calculations', () => {
    test('All financial metric cards should display valid currency values', async () => {
      await page.waitForSelector('.text-3xl', { timeout: 10000 })
      
      // Get all metric values
      const metricCards = page.locator('.group').filter({ has: page.locator('.text-3xl') })
      const cardCount = await metricCards.count()
      
      expect(cardCount).toBe(4) // Should have exactly 4 metric cards
      
      for (let i = 0; i < cardCount; i++) {
        const card = metricCards.nth(i)
        const valueText = await card.locator('.text-3xl').textContent()
        
        // Should be valid currency format (allow for various formats including negative)
        expect(valueText).toMatch(/^[\-]?[£$€¥₹kr]?\s*[\d,]+(\.\d{1,2})?$/)
        
        // Extract numeric value
        const numericValue = parseFloat(valueText?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
        
        // Cash Balance and Revenue should not be negative
        const cardTitle = await card.locator('.text-sm').textContent()
        if (cardTitle?.includes('Revenue') || cardTitle?.includes('Cash Balance')) {
          expect(numericValue).toBeGreaterThanOrEqual(0)
        }
      }
    })

    test('Net Income should equal Total Revenue minus Total Expenses', async () => {
      await page.waitForSelector('.text-3xl', { timeout: 10000 })
      
      // Get Total Revenue
      const revenueCard = page.locator('.group').filter({ has: page.locator('text="Total Revenue"') })
      const revenueText = await revenueCard.locator('.text-3xl').textContent()
      const revenue = parseFloat(revenueText?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
      
      // Get Total Expenses
      const expensesCard = page.locator('.group').filter({ has: page.locator('text="Total Expenses"') })
      const expensesText = await expensesCard.locator('.text-3xl').textContent()
      const expenses = parseFloat(expensesText?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
      
      // Get Net Income
      const netIncomeCard = page.locator('.group').filter({ has: page.locator('text="Net Income"') })
      const netIncomeText = await netIncomeCard.locator('.text-3xl').textContent()
      const isNegative = netIncomeText?.includes('-')
      const netIncome = parseFloat(netIncomeText?.replace(/[£$€¥₹kr,\s\-]/g, '') || '0') * (isNegative ? -1 : 1)
      
      // Calculate expected net income
      const expectedNetIncome = revenue - expenses
      
      // Should match within small tolerance
      expect(Math.abs(netIncome - expectedNetIncome)).toBeLessThan(0.01)
      
      // Net Income card should show correct color based on value
      const netIncomeValueElement = netIncomeCard.locator('.text-3xl')
      const classes = await netIncomeValueElement.getAttribute('class')
      
      if (netIncome < 0) {
        expect(classes).toContain('text-red')
      } else {
        expect(classes).toContain('text-white')
      }
    })

    test('Growth percentages should be displayed with correct colors', async () => {
      await page.waitForSelector('.text-3xl', { timeout: 10000 })
      
      // Check Revenue growth
      const revenueCard = page.locator('.group').filter({ has: page.locator('text="Total Revenue"') })
      const revenueGrowth = await revenueCard.locator('span.text-xs').textContent()
      
      if (revenueGrowth) {
        expect(revenueGrowth).toMatch(/^[+-]?\d+(\.\d+)?%$/)
        
        const growthElement = revenueCard.locator('span.text-xs')
        const classes = await growthElement.getAttribute('class')
        
        if (revenueGrowth.startsWith('+') || !revenueGrowth.startsWith('-')) {
          expect(classes).toContain('text-green')
        } else {
          expect(classes).toContain('text-red')
        }
      }
      
      // Check Expenses growth (negative is good for expenses)
      const expensesCard = page.locator('.group').filter({ has: page.locator('text="Total Expenses"') })
      const expensesGrowth = await expensesCard.locator('span.text-xs').textContent()
      
      if (expensesGrowth) {
        const growthElement = expensesCard.locator('span.text-xs')
        const classes = await growthElement.getAttribute('class')
        
        // For expenses, negative growth is good (green), positive is bad (red)
        if (expensesGrowth.startsWith('-')) {
          expect(classes).toContain('text-green')
        } else {
          expect(classes).toContain('text-red')
        }
      }
    })

    test('Profit margin should be calculated correctly in Net Income card', async () => {
      await page.waitForSelector('.text-3xl', { timeout: 10000 })
      
      // Get values
      const revenueText = await page.locator('.group:has-text("Total Revenue") .text-3xl').textContent()
      const revenue = parseFloat(revenueText?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
      
      const netIncomeCard = page.locator('.group').filter({ has: page.locator('text="Net Income"') })
      const netIncomeText = await netIncomeCard.locator('.text-3xl').textContent()
      const isNegative = netIncomeText?.includes('-')
      const netIncome = parseFloat(netIncomeText?.replace(/[£$€¥₹kr,\s\-]/g, '') || '0') * (isNegative ? -1 : 1)
      
      const profitMarginText = await netIncomeCard.locator('span.text-xs').textContent()
      
      if (profitMarginText && revenue > 0) {
        const displayedMargin = parseFloat(profitMarginText.replace('%', ''))
        const expectedMargin = (netIncome / revenue) * 100
        
        // Should match within 0.5% (accounting for rounding)
        expect(Math.abs(displayedMargin - expectedMargin)).toBeLessThan(0.5)
      }
    })
  })

  test.describe('Module Cards Functionality', () => {
    test('Bookkeeping module should show correct unreconciled count', async () => {
      await page.waitForSelector('.bg-slate-800\\/30', { timeout: 10000 })
      
      const bookkeepingCard = page.locator('.bg-slate-800\\/30').filter({ has: page.locator('h3:text("Bookkeeping")') })
      const unreconciledBadge = bookkeepingCard.locator('text=/\\d+ unreconciled/')
      
      if (await unreconciledBadge.isVisible()) {
        const badgeText = await unreconciledBadge.textContent()
        const count = parseInt(badgeText?.match(/(\d+)/)?.[1] || '0')
        
        expect(count).toBeGreaterThanOrEqual(0)
        
        // Click to navigate
        await bookkeepingCard.click()
        await page.waitForURL('/bookkeeping')
        
        // Verify count matches dashboard
        const dashboardUnreconciled = await page.locator('.text-4xl').first().textContent()
        const dashboardCount = parseInt(dashboardUnreconciled || '0')
        
        expect(count).toBe(dashboardCount)
      }
    })

    test('Coming Soon modules should not be clickable', async () => {
      await page.waitForSelector('.bg-slate-800\\/30', { timeout: 10000 })
      
      const comingSoonModules = page.locator('.bg-slate-800\\/30').filter({ 
        has: page.locator('span:text("Coming Soon")') 
      })
      
      const moduleCount = await comingSoonModules.count()
      expect(moduleCount).toBe(3) // Should have 3 coming soon modules
      
      for (let i = 0; i < moduleCount; i++) {
        const module = comingSoonModules.nth(i)
        
        // Should show "Not Available" status
        await expect(module.locator('text="Not Available"')).toBeVisible()
        
        // Should have muted styling
        const opacity = await module.evaluate(el => window.getComputedStyle(el).opacity)
        expect(parseFloat(opacity)).toBeLessThan(1)
        
        // Clicking should not navigate
        const currentUrl = page.url()
        await module.click()
        expect(page.url()).toBe(currentUrl)
      }
    })
  })

  test.describe('Quick Insights Data Validation', () => {
    test('Financial Health metrics should be within valid ranges', async () => {
      await page.waitForSelector('text="Financial Health"', { timeout: 10000 })
      
      const healthCard = page.locator('div').filter({ has: page.locator('h3:text("Financial Health")') })
      
      // Quick Ratio
      const quickRatioDiv = healthCard.locator('div.flex').filter({ hasText: 'Quick Ratio' }).first()
      if (await quickRatioDiv.isVisible()) {
        const quickRatioText = await quickRatioDiv.textContent()
        const ratioMatch = quickRatioText?.match(/(\d+\.\d+)/)
        if (ratioMatch) {
          const ratio = parseFloat(ratioMatch[1])
          expect(ratio).toBeGreaterThanOrEqual(0)
          expect(ratio).toBeLessThanOrEqual(10) // Reasonable upper limit
        }
      }
      
      // Cash Flow Trend
      const trendElement = healthCard.locator('text=/Cash Flow.*positive|negative/')
      if (await trendElement.isVisible()) {
        const trendText = await trendElement.textContent()
        const trendSpan = healthCard.locator('span').filter({ hasText: /positive|negative/ })
        const classes = await trendSpan.getAttribute('class')
        
        if (trendText?.includes('positive')) {
          expect(classes).toContain('text-green')
        } else {
          expect(classes).toContain('text-red')
        }
      }
      
      // Profit Margin
      const marginText = await healthCard.locator('text=/Profit Margin.*%/').textContent()
      if (marginText) {
        const margin = parseFloat(marginText.match(/([\-]?\d+\.\d+)%/)?.[1] || '0')
        expect(margin).toBeGreaterThanOrEqual(-100)
        expect(margin).toBeLessThanOrEqual(100)
      }
    })

    test('Pending Actions should show actionable counts', async () => {
      await page.waitForSelector('text="Pending Actions"', { timeout: 10000 })
      
      const actionsCard = page.locator('div').filter({ has: page.locator('h3:text("Pending Actions")') })
      
      // All counts should be non-negative integers
      const counts = await actionsCard.locator('span.font-semibold').allTextContents()
      
      counts.forEach(count => {
        const num = parseInt(count)
        expect(num).toBeGreaterThanOrEqual(0)
        expect(Number.isInteger(num)).toBe(true)
      })
      
      // Urgent items (60+ days) should have warning color
      const oldUnreconciledDiv = actionsCard.locator('div.flex').filter({ hasText: 'Old Unreconciled' }).first()
      if (await oldUnreconciledDiv.isVisible()) {
        const oldCount = await oldUnreconciledDiv.locator('span.font-semibold').textContent()
        
        if (parseInt(oldCount || '0') > 0) {
          const classes = await oldUnreconciledDiv.locator('span.font-semibold').getAttribute('class')
          expect(classes).toContain('text-amber')
        }
      }
    })

    test('Period Summary should match main metric cards', async () => {
      await page.waitForSelector('text="Period Summary"', { timeout: 10000 })
      
      const summaryCard = page.locator('div').filter({ has: page.locator('h3:text("Period Summary")') })
      
      // Get summary values with simpler approach
      const summaryRows = summaryCard.locator('div.flex.items-center.justify-between')
      const summaryRevenue = await summaryRows.filter({ hasText: 'Total Revenue' }).locator('div').last().textContent()
      const summaryExpenses = await summaryRows.filter({ hasText: 'Total Expenses' }).locator('div').last().textContent()
      const summaryNetIncome = await summaryRows.filter({ hasText: 'Net Income' }).locator('div').last().textContent()
      
      // Get main card values
      const mainRevenue = await page.locator('.group:has-text("Total Revenue") .text-3xl').textContent()
      const mainExpenses = await page.locator('.group:has-text("Total Expenses") .text-3xl').textContent()
      const mainNetIncome = await page.locator('.group:has-text("Net Income") .text-3xl').textContent()
      
      // Values should match
      expect(summaryRevenue).toBe(mainRevenue)
      expect(summaryExpenses).toBe(mainExpenses)
      expect(summaryNetIncome).toBe(mainNetIncome)
    })
  })

  test.describe('Time Range Functionality', () => {
    test('Changing time range should update all metrics', async () => {
      await page.waitForSelector('.text-3xl', { timeout: 10000 })
      
      // Get initial 30-day revenue
      const initial30dRevenue = await page.locator('.group:has-text("Total Revenue") .text-3xl').textContent()
      
      // Change to Last 7 days
      const timeRangeSelect = page.locator('select')
      await timeRangeSelect.selectOption('Last 7 days')
      
      // Wait for update
      await page.waitForTimeout(1000)
      
      // Get new 7-day revenue
      const new7dRevenue = await page.locator('.group:has-text("Total Revenue") .text-3xl').textContent()
      
      // Parse values
      const revenue30d = parseFloat(initial30dRevenue?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
      const revenue7d = parseFloat(new7dRevenue?.replace(/[£$€¥₹kr,\s]/g, '') || '0')
      
      // 7-day revenue should typically be less than 30-day
      // But could be equal if no transactions in older period
      expect(revenue7d).toBeLessThanOrEqual(revenue30d)
      
      // All cards should update
      const allMetricValues = await page.locator('.text-3xl').allTextContents()
      allMetricValues.forEach(value => {
        expect(value).toMatch(/[£$€¥₹kr]/) // Should still show currency
      })
    })
  })

  test.describe('Navigation and Routing', () => {
    test('Back to Home should redirect back to finance', async () => {
      // Click Back to Home
      const backButton = page.locator('button:has-text("Back to Home")')
      await backButton.click()
      
      // Should stay on finance (home redirects to finance)
      await expect(page).toHaveURL('/finance')
    })

    test('Module quick action buttons should navigate correctly', async () => {
      await page.waitForSelector('.bg-slate-800\\/30', { timeout: 10000 })
      
      const bookkeepingCard = page.locator('.bg-slate-800\\/30').filter({ has: page.locator('h3:text("Bookkeeping")') })
      
      // Test View All button instead of SOP Generator (which may not exist)
      const viewAllButton = bookkeepingCard.locator('button:has-text("View All")')
      if (await viewAllButton.isVisible()) {
        await viewAllButton.click()
        await expect(page).toHaveURL('/bookkeeping')
      }
    })
  })
})
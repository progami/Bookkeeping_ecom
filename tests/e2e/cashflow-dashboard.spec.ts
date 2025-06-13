import { test, expect } from '@playwright/test'

test.describe('Cash Flow Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to finance dashboard first
    await page.goto('https://localhost:3003/finance')
    await page.waitForLoadState('networkidle')
  })

  test('should navigate to cash flow module from finance dashboard', async ({ page }) => {
    // Click on Cash Flow Management card
    await page.click('text=Cash Flow Management')
    
    // Should navigate to cash flow page
    await expect(page).toHaveURL('https://localhost:3003/cashflow')
    
    // Should show cash flow heading
    await expect(page.locator('h1')).toContainText('Cash Flow Forecast')
    
    // Should show forecast period selector
    await expect(page.locator('select').first()).toBeVisible()
    await expect(page.locator('select').first()).toContainText('90 days')
  })

  test('should display cash flow summary cards', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')

    // Check summary cards are visible (may have 4 or 5 cards)
    const summaryCards = page.locator('.bg-slate-800\\/30').filter({ hasText: /Cash Balance|Lowest Balance|Total Inflows|Critical Alerts/i })
    const cardCount = await summaryCards.count()
    expect(cardCount).toBeGreaterThanOrEqual(4)

    // Cash Balance card
    await expect(page.locator('text=Cash Balance').first()).toBeVisible()
    await expect(page.locator('text=£').first()).toBeVisible()

    // Lowest Balance card
    await expect(page.locator('text=Lowest Balance')).toBeVisible()

    // Total Inflows card
    await expect(page.locator('text=Total Inflows')).toBeVisible()

    // Critical Alerts card
    await expect(page.locator('text=Critical Alerts')).toBeVisible()
  })

  test('should change forecast period', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')

    // Change forecast period
    const periodSelector = page.locator('select').first()
    await periodSelector.selectOption('30')

    // Wait for data to reload
    await page.waitForLoadState('networkidle')

    // Check that the period changed
    await expect(periodSelector).toHaveValue('30')
    
    // Check subtitle updated
    await expect(page.locator('p.text-gray-400').first()).toContainText('30-day projection')
  })

  test('should display cash flow chart', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for chart to render
    await page.waitForTimeout(1000)

    // Check chart container exists
    const chartContainer = page.locator('.recharts-responsive-container').first()
    await expect(chartContainer).toBeVisible({ timeout: 10000 })

    // Check chart controls
    await expect(page.locator('text=Show Scenarios')).toBeVisible()
    await expect(page.locator('button:has-text("Daily")')).toBeVisible()
    await expect(page.locator('button:has-text("Weekly")')).toBeVisible()
    await expect(page.locator('button:has-text("Monthly")')).toBeVisible()
  })

  test('should toggle scenario view', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')

    // Toggle scenarios checkbox
    const scenariosCheckbox = page.locator('input[type="checkbox"]').first()
    await scenariosCheckbox.check()

    // Wait for chart update
    await page.waitForTimeout(500)

    // Scenarios should be enabled
    await expect(scenariosCheckbox).toBeChecked()
  })

  test('should switch between view modes', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')

    // Click Weekly view
    await page.click('button:has-text("Weekly")')
    await expect(page.locator('button:has-text("Weekly")')).toHaveClass(/bg-cyan-600/)

    // Click Monthly view
    await page.click('button:has-text("Monthly")')
    await expect(page.locator('button:has-text("Monthly")')).toHaveClass(/bg-cyan-600/)

    // Click back to Daily view
    await page.click('button:has-text("Daily")')
    await expect(page.locator('button:has-text("Daily")')).toHaveClass(/bg-cyan-600/)
  })

  test('should display alerts section', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Check alerts section exists
    await expect(page.locator('text=Alerts & Actions')).toBeVisible({ timeout: 10000 })

    // Alerts container should exist (may be empty initially)
    const alertsContainer = page.locator('.space-y-3.max-h-\\[300px\\]')
    await expect(alertsContainer).toHaveCount(1)
  })

  test('should display budget management section', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Check budget management section
    await expect(page.locator('text=Budget Management')).toBeVisible({ timeout: 10000 })

    // Check buttons are visible
    await expect(page.locator('button:has-text("Download Template")')).toBeVisible()
    await expect(page.locator('label:has-text("Import Budget")')).toBeVisible()
    await expect(page.locator('button:has-text("Export Budget")')).toBeVisible()

    // Check budget status
    await expect(page.locator('text=Budget Status')).toBeVisible()
    await expect(page.locator('text=Import Options')).toBeVisible()
    await expect(page.locator('text=Last Import')).toBeVisible()
  })

  test('should handle sync data action', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Mock API response
    await page.route('**/api/v1/cashflow/sync', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          syncType: 'DELTA',
          summary: {
            itemsSynced: 50,
            itemsCreated: 10,
            itemsUpdated: 40,
            itemsDeleted: 0,
            taxObligationsCreated: 3,
          },
        }),
      })
    })

    // Click sync button
    await page.click('button:has-text("Sync Data")')

    // Should show loading state
    await expect(page.locator('.animate-spin')).toBeVisible()

    // Wait for success toast (use first() to handle multiple toasts)
    await expect(page.locator('text=Sync complete').first()).toBeVisible({ timeout: 10000 })
  })

  test('should display loading state correctly', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/v1/cashflow/forecast*', async route => {
      await page.waitForTimeout(3000) // Simulate slow response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forecast: [],
          summary: {
            days: 90,
            lowestBalance: 0,
            lowestBalanceDate: new Date().toISOString(),
            totalInflows: 0,
            totalOutflows: 0,
            averageConfidence: 0,
            criticalAlerts: 0,
          },
        }),
      })
    })

    await page.goto('https://localhost:3003/cashflow')

    // Should show loading spinner while data loads
    // Look for any spinner element
    const spinner = page.locator('.animate-spin').first()
    await expect(spinner).toBeVisible({ timeout: 2000 })

    // Wait for content to load
    await page.waitForLoadState('networkidle')
    
    // Spinner should be gone
    await expect(spinner).not.toBeVisible()
  })

  test('should navigate back to finance dashboard', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Click back button
    await page.click('text=Back to Finance')

    // Should navigate back to finance dashboard
    await expect(page).toHaveURL('https://localhost:3003/finance', { timeout: 10000 })
  })

  test('should display daily cash movements chart', async ({ page }) => {
    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')
    
    // Wait for page to fully load
    await page.waitForTimeout(1000)

    // Check daily movements section
    await expect(page.locator('text=Daily Cash Movements')).toBeVisible({ timeout: 10000 })

    // Check for bar chart
    const barChartContainer = page.locator('.recharts-responsive-container').nth(1)
    await expect(barChartContainer).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/v1/cashflow/forecast*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await page.goto('https://localhost:3003/cashflow')

    // Should show error toast (use first() to handle multiple toasts)
    await expect(page.locator('text=Failed to load cash flow forecast').first()).toBeVisible({ timeout: 10000 })
  })

  test('should display confidence level in subtitle', async ({ page }) => {
    // Mock API response with specific confidence
    await page.route('**/api/v1/cashflow/forecast*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forecast: [{
            date: new Date().toISOString(),
            openingBalance: 10000,
            closingBalance: 10000,
            inflows: { fromInvoices: 0, fromRepeating: 0, total: 0 },
            outflows: { toBills: 0, toRepeating: 0, toTaxes: 0, toPatterns: 0, toBudgets: 0, total: 0 },
            confidenceLevel: 0.85,
            alerts: [],
          }],
          summary: {
            days: 90,
            lowestBalance: 10000,
            lowestBalanceDate: new Date().toISOString(),
            totalInflows: 0,
            totalOutflows: 0,
            averageConfidence: 0.85,
            criticalAlerts: 0,
          },
        }),
      })
    })

    await page.goto('https://localhost:3003/cashflow')
    await page.waitForLoadState('networkidle')

    // Should show confidence in subtitle
    await expect(page.locator('p.text-gray-400').first()).toContainText('85% average confidence')
  })
})
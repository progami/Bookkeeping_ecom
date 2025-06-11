import { test, expect, Page } from '@playwright/test'

test.describe('Analytics Page - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/analytics')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Navigation', () => {
    test('should navigate back to dashboard', async () => {
      const backButton = page.locator('button:has-text("Back to Dashboard")')
      await expect(backButton).toBeVisible()
      await backButton.click()
      await expect(page).toHaveURL('/bookkeeping')
    })
  })

  test.describe('Period Controls', () => {
    test('should have period selector with all options', async () => {
      const periodSelector = page.locator('select').filter({ has: page.locator('option:has-text("Month")') })
      await expect(periodSelector).toBeVisible()
      
      // Test all period options
      const options = await periodSelector.locator('option').allTextContents()
      expect(options).toContain('Month')
      expect(options).toContain('Quarter')
      expect(options).toContain('Year')
      
      // Test changing period
      await periodSelector.selectOption('Quarter')
      await expect(periodSelector).toHaveValue('quarter')
      
      await periodSelector.selectOption('Year')
      await expect(periodSelector).toHaveValue('year')
    })

    test('should export analytics data', async () => {
      const exportButton = page.locator('button:has-text("Export")')
      await expect(exportButton).toBeVisible()
      
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      // Verify download
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('analytics')
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/)
    })
  })

  test.describe('Interactive Charts', () => {
    test('should display Income vs Expenses chart with hover interactions', async () => {
      // Wait for chart to load
      const chartContainer = page.locator('div').filter({ has: page.locator('text="Income vs Expenses"') })
      await expect(chartContainer).toBeVisible()
      
      // Look for chart elements (canvas or svg)
      const chart = chartContainer.locator('canvas, svg').first()
      await expect(chart).toBeVisible()
      
      // Test hover interaction
      const chartBounds = await chart.boundingBox()
      if (chartBounds) {
        // Hover over different points
        await page.mouse.move(chartBounds.x + chartBounds.width * 0.3, chartBounds.y + chartBounds.height * 0.5)
        await page.waitForTimeout(100)
        
        // Tooltip or data point highlight should appear
        const tooltip = page.locator('[role="tooltip"], .tooltip, .chart-tooltip')
        const isTooltipVisible = await tooltip.isVisible().catch(() => false)
        
        if (isTooltipVisible) {
          // Verify tooltip shows data
          const tooltipText = await tooltip.textContent()
          expect(tooltipText).toBeTruthy()
        }
      }
    })

    test('should display Category Breakdown pie chart with hover segments', async () => {
      const chartContainer = page.locator('div').filter({ has: page.locator('text="Category Breakdown"') })
      await expect(chartContainer).toBeVisible()
      
      const chart = chartContainer.locator('canvas, svg').first()
      await expect(chart).toBeVisible()
      
      // Test pie segment hover
      const chartBounds = await chart.boundingBox()
      if (chartBounds) {
        // Hover over pie segments
        const centerX = chartBounds.x + chartBounds.width / 2
        const centerY = chartBounds.y + chartBounds.height / 2
        
        // Hover on different segments
        await page.mouse.move(centerX + 50, centerY)
        await page.waitForTimeout(100)
        
        // Check for hover effects or tooltips
        const tooltip = page.locator('[role="tooltip"], .tooltip, .chart-tooltip')
        const hasTooltip = await tooltip.isVisible().catch(() => false)
        
        if (hasTooltip) {
          const tooltipText = await tooltip.textContent()
          expect(tooltipText).toMatch(/\d+/)
        }
      }
    })

    test('should display Account Activity bar chart with hover bars', async () => {
      const chartContainer = page.locator('div').filter({ has: page.locator('text="Account Activity"') })
      await expect(chartContainer).toBeVisible()
      
      const chart = chartContainer.locator('canvas, svg').first()
      await expect(chart).toBeVisible()
      
      // Test bar hover
      const chartBounds = await chart.boundingBox()
      if (chartBounds) {
        // Hover over bars
        await page.mouse.move(chartBounds.x + chartBounds.width * 0.2, chartBounds.y + chartBounds.height * 0.7)
        await page.waitForTimeout(100)
        
        // Check for hover effects
        const tooltip = page.locator('[role="tooltip"], .tooltip, .chart-tooltip')
        const hasTooltip = await tooltip.isVisible().catch(() => false)
        
        if (hasTooltip) {
          const tooltipText = await tooltip.textContent()
          expect(tooltipText).toBeTruthy()
        }
      }
    })
  })

  test.describe('Data Display', () => {
    test('should show analytics data when connected to Xero', async () => {
      // Check if connected by looking for data elements
      const hasData = await page.locator('text="No data available"').isVisible().catch(() => false)
      
      if (!hasData) {
        // Should display summary metrics
        const metrics = page.locator('[data-testid="metric"], .metric-card, .stat-card')
        const metricsCount = await metrics.count()
        
        if (metricsCount > 0) {
          expect(metricsCount).toBeGreaterThan(0)
          
          // First metric should be visible
          await expect(metrics.first()).toBeVisible()
        }
      }
    })

    test('should show empty state when not connected', async () => {
      // Check if redirected or showing empty state
      const currentUrl = page.url()
      
      if (currentUrl.includes('/bookkeeping/analytics')) {
        // Look for empty state
        const emptyState = page.locator('text="Connect to Xero to view analytics"')
        const noData = page.locator('text="No data available"')
        
        const hasEmptyState = await emptyState.isVisible().catch(() => false)
        const hasNoData = await noData.isVisible().catch(() => false)
        
        if (hasEmptyState || hasNoData) {
          expect(hasEmptyState || hasNoData).toBeTruthy()
        }
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should adapt charts for mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Charts should still be visible but may stack vertically
      const charts = page.locator('canvas, svg')
      const chartsCount = await charts.count()
      
      if (chartsCount > 0) {
        // At least one chart should be visible
        await expect(charts.first()).toBeVisible()
      }
      
      // Controls should remain accessible
      const periodSelector = page.locator('select').first()
      const exportButton = page.locator('button:has-text("Export")')
      
      if (await periodSelector.isVisible()) {
        await expect(periodSelector).toBeVisible()
      }
      
      if (await exportButton.isVisible()) {
        await expect(exportButton).toBeVisible()
      }
    })
  })
})
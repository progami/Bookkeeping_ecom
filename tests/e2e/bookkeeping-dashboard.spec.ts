import { test, expect, Page } from '@playwright/test'

test.describe('Bookkeeping Dashboard', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/finance/bookkeeping')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should display bookkeeping dashboard with correct elements', async () => {
    // Title and description
    await expect(page.locator('h1')).toContainText('Bookkeeping Dashboard')
    
    // Back to Finance button
    const backButton = page.locator('button:has-text("Back to Finance")')
    await expect(backButton).toBeVisible()
  })

  test('should show Xero connection status', async () => {
    // Check for either connected or disconnected state
    const connectedText = page.locator('text=/Connected to|Connect to Xero to get started/')
    await expect(connectedText).toBeVisible()
  })

  test('should display financial overview cards when connected', async () => {
    // Skip if not connected to Xero
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      // Cash in Bank card
      await expect(page.locator('div:has-text("Cash in Bank")')).toBeVisible()
      
      // Income card
      await expect(page.locator('div:has-text("Income")')).toBeVisible()
      
      // Expenses card
      await expect(page.locator('div:has-text("Expenses")')).toBeVisible()
      
      // Net Cash Flow card
      await expect(page.locator('div:has-text("Net Cash Flow")')).toBeVisible()
    } else {
      // Should show connect to Xero CTA
      await expect(page.locator('text="Connect to Xero"')).toBeVisible()
      await expect(page.locator('button:has-text("Connect Xero Account")')).toBeVisible()
    }
  })

  test('should have sync functionality when connected', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const syncButton = page.locator('button:has-text("Sync Now")')
      await expect(syncButton).toBeVisible()
      
      // Check if button is not disabled
      const isDisabled = await syncButton.isDisabled()
      expect(isDisabled).toBe(false)
    }
  })

  test('should display bank accounts section', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const bankAccountsSection = page.locator('h2:has-text("Bank Accounts")')
      await expect(bankAccountsSection).toBeVisible()
      
      // Check for account count
      const accountCount = page.locator('text=/[0-9]+ accounts/')
      await expect(accountCount).toBeVisible()
    }
  })

  test('should display recent transactions section', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const transactionsSection = page.locator('h2:has-text("Recent Transactions")')
      await expect(transactionsSection).toBeVisible()
      
      // View all link
      const viewAllLink = page.locator('button:has-text("View all")')
      await expect(viewAllLink).toBeVisible()
    }
  })

  test('should display reconciliation status', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const reconciliationSection = page.locator('h2:has-text("Reconciliation")')
      await expect(reconciliationSection).toBeVisible()
      
      // Should show unreconciled count
      const unreconciledCount = page.locator('text="Unreconciled Transactions"')
      await expect(unreconciledCount).toBeVisible()
    }
  })

  test('should display quick actions section', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const quickActionsSection = page.locator('h2:has-text("Quick Actions")')
      await expect(quickActionsSection).toBeVisible()
      
      // SOP Generator button
      const sopButton = page.locator('button:has-text("SOP Generator")')
      await expect(sopButton).toBeVisible()
      await expect(sopButton.locator('span:has-text("NEW")')).toBeVisible()
      
      // All Transactions button
      const transactionsButton = page.locator('button:has-text("All Transactions")')
      await expect(transactionsButton).toBeVisible()
      
      // Manage Rules button
      const rulesButton = page.locator('button:has-text("Manage Rules")')
      await expect(rulesButton).toBeVisible()
      
      // SOP Tables button
      const sopTablesButton = page.locator('button:has-text("SOP Tables")')
      await expect(sopTablesButton).toBeVisible()
    }
  })

  test('should navigate to SOP Generator when clicked', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const sopButton = page.locator('button:has-text("SOP Generator")')
      await sopButton.click()
      
      await expect(page).toHaveURL(/\/sop-generator/)
      await expect(page.locator('h1')).toContainText('SOP Generator')
    }
  })

  test('should display automation status', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const automationSection = page.locator('h2:has-text("Automation")')
      await expect(automationSection).toBeVisible()
      
      // Active Rules
      await expect(page.locator('text="Active Rules"')).toBeVisible()
      
      // Match Rate
      await expect(page.locator('text="Match Rate"')).toBeVisible()
      
      // Configure Rules link
      const configureLink = page.locator('button:has-text("Configure Rules")')
      await expect(configureLink).toBeVisible()
    }
  })

  test('should have time range selector', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const timeRangeSelector = page.locator('select').first()
      await expect(timeRangeSelector).toBeVisible()
      
      // Check options
      await expect(timeRangeSelector.locator('option[value="7d"]')).toBeVisible()
      await expect(timeRangeSelector.locator('option[value="30d"]')).toBeVisible()
      await expect(timeRangeSelector.locator('option[value="90d"]')).toBeVisible()
    }
  })

  test('should display Xero connection info at bottom', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      const connectionSection = page.locator('h3:has-text("Xero Connection")')
      await expect(connectionSection).toBeVisible()
      
      // Disconnect button
      const disconnectButton = page.locator('button:has-text("Disconnect")')
      await expect(disconnectButton).toBeVisible()
    }
  })

  test('should handle responsive layout', async () => {
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 })
    const mainGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-3').first()
    await expect(mainGrid).toBeVisible()
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(100)
    await expect(mainGrid).toBeVisible()
  })

  test('should show proper hover effects on cards', async () => {
    const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
    
    if (isConnected) {
      // Test hover on financial card
      const cashCard = page.locator('div:has-text("Cash in Bank")').first()
      await cashCard.hover()
      
      // Card should have hover styles applied
      await expect(cashCard).toHaveClass(/hover:border-emerald-500/)
    }
  })
})
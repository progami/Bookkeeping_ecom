import { test, expect, Page } from '@playwright/test'

test.describe('Bookkeeping Dashboard - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Navigation Elements', () => {
    test('should navigate back to finance dashboard', async () => {
      const backButton = page.locator('button:has-text("Back to Home")')
      await expect(backButton).toBeVisible()
      await backButton.click()
      // Home redirects to finance
      await expect(page).toHaveURL('/finance')
    })

    test('should have time range selector with all options', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const timeRangeSelector = page.locator('select').first()
        await expect(timeRangeSelector).toBeVisible()
        
        // Test all options exist
        const options = await timeRangeSelector.locator('option').allTextContents()
        expect(options).toContain('Last 7 days')
        expect(options).toContain('Last 30 days')
        expect(options).toContain('Last 90 days')
      }
    })

    test('should navigate to analytics when clicking Analytics button', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const analyticsButton = page.locator('button:has-text("Analytics")')
        if (await analyticsButton.isVisible()) {
          await analyticsButton.click()
          await expect(page).toHaveURL('/bookkeeping/analytics')
        }
      }
    })

    test('should have sync now button when connected', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const syncButton = page.locator('button:has-text("Sync Now")')
        await expect(syncButton).toBeVisible()
        await expect(syncButton).not.toBeDisabled()
        
        // Test sync functionality
        await syncButton.click()
        // Should show syncing state
        await expect(page.locator('.animate-spin')).toBeVisible()
      }
    })

    test('should show connect Xero button when not connected', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (!isConnected) {
        const connectButton = page.locator('button:has-text("Connect Xero Account")')
        await expect(connectButton).toBeVisible()
      }
    })
  })

  test.describe('Financial Overview Cards', () => {
    test('should display all financial cards when connected', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Test all 4 cards
        const cashCard = page.locator('div:has-text("Cash in Bank")').first()
        const incomeCard = page.locator('div:has-text("Income")').filter({ hasText: 'days' })
        const expensesCard = page.locator('div:has-text("Expenses")').filter({ hasText: 'days' })
        const netCashCard = page.locator('div:has-text("Net Cash Flow")')
        
        await expect(cashCard).toBeVisible()
        await expect(incomeCard).toBeVisible()
        await expect(expensesCard).toBeVisible()
        await expect(netCashCard).toBeVisible()
        
        // Test hover effects
        await cashCard.hover()
        // Wait a moment for hover state
        await page.waitForTimeout(100)
      }
    })
  })

  test.describe('Bank Accounts Section', () => {
    test('should display bank accounts with clickable cards', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const bankAccountsSection = page.locator('h2:has-text("Bank Accounts")')
        await expect(bankAccountsSection).toBeVisible()
        
        // Find first bank account card
        const firstAccount = page.locator('div[onclick*="transactions"]').first()
        if (await firstAccount.isVisible()) {
          // Test hover effect
          await firstAccount.hover()
          
          // Click should navigate to transactions
          await firstAccount.click()
          await expect(page).toHaveURL(/\/transactions/)
          await page.goBack()
        }
      }
    })

    test('should display last updated date and unreconciled count on bank cards', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const bankCards = page.locator('div[onclick*="transactions"]')
        const count = await bankCards.count()
        
        if (count > 0) {
          const firstCard = bankCards.first()
          
          // Check for last updated date
          const lastUpdated = firstCard.locator('text=/Updated|Last sync|ago/')
          const hasLastUpdated = await lastUpdated.isVisible().catch(() => false)
          
          if (hasLastUpdated) {
            const dateText = await lastUpdated.textContent()
            expect(dateText).toBeTruthy()
          }
          
          // Check for unreconciled count
          const unreconciledBadge = firstCard.locator('span:has-text("unreconciled"), [class*="badge"]')
          const hasUnreconciled = await unreconciledBadge.isVisible().catch(() => false)
          
          if (hasUnreconciled) {
            const countText = await unreconciledBadge.textContent()
            expect(countText).toMatch(/\d+/)
          }
        }
      }
    })
  })

  test.describe('Recent Transactions Section', () => {
    test('should have view all link', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const viewAllButton = page.locator('button:has-text("View all →")')
        await expect(viewAllButton).toBeVisible()
        
        await viewAllButton.click()
        await expect(page).toHaveURL(/\/transactions/)
        await page.goBack()
      }
    })

    test('should display individual transaction items', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Look for transaction items
        const transactionItems = page.locator('.transaction-item, [data-testid="transaction-item"]')
        const count = await transactionItems.count()
        
        if (count > 0) {
          const firstTransaction = transactionItems.first()
          await expect(firstTransaction).toBeVisible()
          
          // Should show amount
          const amount = await firstTransaction.locator('[class*="amount"], .text-right').textContent()
          expect(amount).toMatch(/[\d,.-]+/)
          
          // Should show description
          const description = await firstTransaction.locator('[class*="description"], .text-sm').textContent()
          expect(description).toBeTruthy()
          
          // Should show date
          const date = await firstTransaction.locator('[class*="date"], .text-gray').textContent()
          expect(date).toBeTruthy()
        }
      }
    })
  })

  test.describe('Reconciliation Status', () => {
    test('should show start reconciling button when unreconciled exist', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const unreconciledCount = await page.locator('text="Unreconciled Transactions"').isVisible()
        
        if (unreconciledCount) {
          const startButton = page.locator('button:has-text("Start Reconciling")')
          if (await startButton.isVisible()) {
            await startButton.click()
            await expect(page).toHaveURL(/\/transactions.*filter=unreconciled/)
            await page.goBack()
          }
        }
      }
    })
  })

  test.describe('Bookkeeping Tools', () => {
    test('should display Bookkeeping Tools section prominently', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Tools section should be prominent, not buried in quick actions
        const toolsSection = page.locator('h2:has-text("Bookkeeping Tools")')
        await expect(toolsSection).toBeVisible()
        
        // Should show all 4 main tools
        const tools = page.locator('h3').filter({ hasText: /(SOP Generator|Transactions|Automation Rules|SOP Tables)/ })
        const toolCount = await tools.count()
        expect(toolCount).toBe(4)
      }
    })
    
    test('should navigate to SOP Generator', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const sopButton = page.locator('button:has-text("SOP Generator")')
        await expect(sopButton).toBeVisible()
        await expect(sopButton.locator('span:has-text("NEW")')).toBeVisible()
        
        await sopButton.click()
        await expect(page).toHaveURL(/\/sop-generator/)
        await page.goBack()
      }
    })

    test('should navigate to Transactions', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const transactionsButton = page.locator('h3:has-text("Transactions")').locator('..')
        await expect(transactionsButton).toBeVisible()
        
        await transactionsButton.click()
        await expect(page).toHaveURL(/\/transactions/)
        await page.goBack()
      }
    })

    test('should navigate to Automation Rules', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const rulesButton = page.locator('h3:has-text("Automation Rules")').locator('..')
        await expect(rulesButton).toBeVisible()
        
        await rulesButton.click()
        await expect(page).toHaveURL(/\/rules/)
        await page.goBack()
      }
    })

    test('should navigate to SOP Tables', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const sopTablesButton = page.locator('button:has-text("SOP Tables")')
        await expect(sopTablesButton).toBeVisible()
        
        await sopTablesButton.click()
        await expect(page).toHaveURL(/\/sop-tables/)
        await page.goBack()
      }
    })
  })

  test.describe('Automation Status', () => {
    test('should display automation metrics and configure link', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const automationSection = page.locator('h2:has-text("Automation")')
        await expect(automationSection).toBeVisible()
        
        // Check metrics
        await expect(page.locator('text="Active Rules"')).toBeVisible()
        await expect(page.locator('text="Match Rate"')).toBeVisible()
        
        // Test configure link
        const configureButton = page.locator('button:has-text("Configure Rules")')
        await expect(configureButton).toBeVisible()
        
        await configureButton.click()
        await expect(page).toHaveURL(/\/rules/)
        await page.goBack()
      }
    })
  })

  test.describe('Xero Connection Status', () => {
    test('should show disconnect button when connected', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        const disconnectButton = page.locator('button:has-text("Disconnect")')
        await expect(disconnectButton).toBeVisible()
        
        // Test confirmation dialog appears
        page.on('dialog', dialog => {
          expect(dialog.message()).toContain('Are you sure')
          dialog.dismiss() // Cancel disconnect
        })
        
        await disconnectButton.click()
      }
    })
  })

  test.describe('Empty States', () => {
    test('should show connect CTA when not connected', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (!isConnected) {
        const connectSection = page.locator('h2:has-text("Connect to Xero")')
        await expect(connectSection).toBeVisible()
        
        const connectButton = page.locator('button:has-text("Connect Xero Account")')
        await expect(connectButton).toBeVisible()
      }
    })
  })
})
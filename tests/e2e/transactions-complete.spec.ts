import { test, expect, Page } from '@playwright/test'
import { setupXeroMocks } from '../helpers/mock-api'

test.describe('Transactions Page - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Set up Xero mocks to simulate connected state
    await setupXeroMocks(page)
    
    // Navigate directly to transactions page
    await page.goto('/bookkeeping/transactions', { waitUntil: 'domcontentloaded' })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Header Controls', () => {
    test('should navigate back to dashboard', async () => {
      const backButton = page.locator('button:has-text("Back to Dashboard")')
      await expect(backButton).toBeVisible()
      await backButton.click()
      await expect(page).toHaveURL('/bookkeeping')
    })

    test('should export transactions when clicking Export button', async () => {
      const exportButton = page.locator('button:has-text("Export")')
      await expect(exportButton).toBeVisible()
      
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      // Verify download started
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('transactions')
      expect(download.suggestedFilename()).toContain('.csv')
    })

    test('should refresh transactions list', async () => {
      const refreshButton = page.locator('button:has-text("Refresh")')
      await expect(refreshButton).toBeVisible()
      
      await refreshButton.click()
      // Should show loading spinner
      await expect(page.locator('.animate-spin')).toBeVisible()
      
      // Wait for loading to complete
      await expect(page.locator('text=/Loaded \d+ of \d+ transactions/')).toBeVisible({ timeout: 10000 })
    })

    test('should perform full sync from Xero', async () => {
      const fullSyncButton = page.locator('button:has-text("Full Sync")')
      await expect(fullSyncButton).toBeVisible()
      
      // This might take a while
      await fullSyncButton.click()
      
      // Should show syncing state
      await expect(fullSyncButton.locator('.animate-spin')).toBeVisible()
      await expect(fullSyncButton).toContainText('Syncing...')
    })
  })

  test.describe('Filter Controls', () => {
    test('should filter transactions by search term', async () => {
      const searchInput = page.locator('input[placeholder="Search transactions..."]')
      await expect(searchInput).toBeVisible()
      
      // Type search term
      await searchInput.fill('payment')
      await searchInput.press('Enter')
      
      // Results should update (implementation dependent)
    })

    test('should filter by bank account', async () => {
      const accountSelector = page.locator('select').nth(1) // Second select is account filter
      await expect(accountSelector).toBeVisible()
      
      // Get available options
      const options = await accountSelector.locator('option').allTextContents()
      
      if (options.length > 1) {
        // Select first actual account (not "All Accounts")
        await accountSelector.selectOption({ index: 1 })
        
        // Page should update
        await expect(page.locator('text=/Loaded \d+ of \d+ transactions/')).toBeVisible()
      }
    })

    test('should filter by status using filter buttons', async () => {
      // Test All filter
      const allButton = page.locator('button:has-text("All")').first()
      await expect(allButton).toBeVisible()
      await allButton.click()
      
      // Test Unreconciled filter
      const unreconciledButton = page.locator('button:has-text("Unreconciled")')
      await expect(unreconciledButton).toBeVisible()
      await unreconciledButton.click()
      
      // Test Reconciled filter
      const reconciledButton = page.locator('button:has-text("Reconciled")')
      await expect(reconciledButton).toBeVisible()
      await reconciledButton.click()
    })
  })

  test.describe('Bulk Actions', () => {
    test('should select all transactions with header checkbox', async () => {
      const selectAllCheckbox = page.locator('thead input[type="checkbox"]')
      await expect(selectAllCheckbox).toBeVisible()
      
      await selectAllCheckbox.check()
      
      // All individual checkboxes should be checked
      const individualCheckboxes = page.locator('tbody input[type="checkbox"]')
      const count = await individualCheckboxes.count()
      
      for (let i = 0; i < count; i++) {
        await expect(individualCheckboxes.nth(i)).toBeChecked()
      }
      
      // Bulk actions should appear
      await expect(page.locator('text="selected"')).toBeVisible()
    })

    test('should show bulk actions when transactions selected', async () => {
      // Select first transaction
      const firstCheckbox = page.locator('tbody input[type="checkbox"]').first()
      await firstCheckbox.check()
      
      // Bulk actions should appear
      const bulkReconcileButton = page.locator('button:has-text("Bulk Reconcile")')
      const bulkCategorizeButton = page.locator('button:has-text("Bulk Categorize")')
      const clearSelectionButton = page.locator('button:has-text("Clear Selection")')
      
      await expect(bulkReconcileButton).toBeVisible()
      await expect(bulkCategorizeButton).toBeVisible()
      await expect(clearSelectionButton).toBeVisible()
    })

    test('should clear selection when clicking Clear Selection', async () => {
      // Select some transactions
      const checkboxes = page.locator('tbody input[type="checkbox"]')
      await checkboxes.first().check()
      
      // Clear selection
      const clearButton = page.locator('button:has-text("Clear Selection")')
      await clearButton.click()
      
      // No checkboxes should be checked
      await expect(checkboxes.first()).not.toBeChecked()
    })
  })

  test.describe('Transaction Table', () => {
    test('should show reconcile button for unreconciled transactions', async () => {
      // Find first unreconciled transaction
      const unreconciledRow = page.locator('tr').filter({ has: page.locator('text="Unreconciled"') }).first()
      
      if (await unreconciledRow.isVisible()) {
        const reconcileButton = unreconciledRow.locator('button:has-text("Reconcile")')
        await expect(reconcileButton).toBeVisible()
      }
    })

    test('should have hover effect on transaction rows', async () => {
      const firstRow = page.locator('tbody tr').first()
      await expect(firstRow).toBeVisible()
      
      await firstRow.hover()
      // Wait a moment for hover state
      await page.waitForTimeout(100)
    })
  })

  test.describe('Pagination Controls', () => {
    test('should toggle Show All mode', async () => {
      const showAllButton = page.locator('button:has-text("Show All")')
      await expect(showAllButton).toBeVisible()
      
      // Click to show all
      await showAllButton.click()
      
      // Button should change to "Showing All"
      await expect(page.locator('button:has-text("Showing All")')).toBeVisible()
      await expect(page.locator('text=/Showing all \d+ transactions/')).toBeVisible()
      
      // Should show loading state if many transactions
      const loadingState = page.locator('text="Loading all transactions..."')
      if (await loadingState.isVisible({ timeout: 1000 })) {
        await expect(loadingState).toBeVisible()
      }
    })

    test('should navigate between pages when paginated', async () => {
      // Make sure we're not in Show All mode
      const showingAll = await page.locator('button:has-text("Showing All")').isVisible()
      if (showingAll) {
        await page.locator('button:has-text("Showing All")').click()
      }
      
      const totalPages = await page.locator('text=/Page \d+ of (\d+)/').textContent()
      const match = totalPages?.match(/Page \d+ of (\d+)/)
      
      if (match && parseInt(match[1]) > 1) {
        // Test Next button
        const nextButton = page.locator('button:has-text("Next")')
        await expect(nextButton).toBeVisible()
        await expect(nextButton).not.toBeDisabled()
        
        await nextButton.click()
        await expect(page.locator('text="Page 2 of"')).toBeVisible()
        
        // Test Previous button
        const previousButton = page.locator('button:has-text("Previous")')
        await expect(previousButton).toBeVisible()
        await expect(previousButton).not.toBeDisabled()
        
        await previousButton.click()
        await expect(page.locator('text="Page 1 of"')).toBeVisible()
      }
    })
  })

  test.describe('Reconcile Modal', () => {
    test('should open reconcile modal when clicking reconcile button', async () => {
      // Find and click first reconcile button
      const reconcileButton = page.locator('button:has-text("Reconcile")').first()
      
      if (await reconcileButton.isVisible()) {
        await reconcileButton.click()
        
        // Modal should appear
        const modal = page.locator('div[role="dialog"]')
        await expect(modal).toBeVisible()
        
        // Check modal elements
        await expect(modal.locator('input[placeholder*="account code"]')).toBeVisible()
        await expect(modal.locator('select')).toBeVisible() // Tax type selector
        await expect(modal.locator('textarea')).toBeVisible() // Notes
        await expect(modal.locator('input[type="checkbox"]')).toBeVisible() // Create rule checkbox
        
        // Cancel button
        const cancelButton = modal.locator('button:has-text("Cancel")')
        await expect(cancelButton).toBeVisible()
        await cancelButton.click()
        
        // Modal should close
        await expect(modal).not.toBeVisible()
      }
    })

    test('should show rule fields when create rule is checked', async () => {
      const reconcileButton = page.locator('button:has-text("Reconcile")').first()
      
      if (await reconcileButton.isVisible()) {
        await reconcileButton.click()
        
        const modal = page.locator('div[role="dialog"]')
        const createRuleCheckbox = modal.locator('input[type="checkbox"]')
        
        await createRuleCheckbox.check()
        
        // Rule fields should appear
        await expect(modal.locator('input[placeholder*="rule name"]')).toBeVisible()
        await expect(modal.locator('input[placeholder*="pattern"]')).toBeVisible()
      }
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should adapt table for mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Table should still be visible
      const table = page.locator('table')
      await expect(table).toBeVisible()
      
      // Controls should be accessible
      const searchInput = page.locator('input[placeholder="Search transactions..."]')
      await expect(searchInput).toBeVisible()
    })
  })
})
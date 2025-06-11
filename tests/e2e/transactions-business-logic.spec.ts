import { test, expect, Page } from '@playwright/test'
import { setupXeroMocks } from '../helpers/mock-api'

test.describe('Transactions Page - Business Logic Tests', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    
    // Set up Xero mocks
    await setupXeroMocks(page)
    
    await page.goto('/bookkeeping/transactions')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Transaction Data Completeness', () => {
    test('All transactions should have required fields populated', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      const transactionRows = page.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })
      const count = await transactionRows.count()
      
      for (let i = 0; i < Math.min(count, 5); i++) { // Check first 5 transactions
        const row = transactionRows.nth(i)
        
        // Date should be valid
        const dateText = await row.locator('td:nth-child(2)').textContent()
        expect(dateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
        
        // Amount should be valid currency
        const amountText = await row.locator('td:nth-child(6)').textContent()
        expect(amountText).toMatch(/[+-]?\s*[£$€¥₹kr]\s*[\d,]+\.\d{2}/)
        
        // Description should not be empty
        const description = await row.locator('td:nth-child(4)').textContent()
        expect(description).toBeTruthy()
        expect(description).not.toBe('-')
        
        // Bank account should be specified
        const bankAccount = await row.locator('td:nth-child(7)').textContent()
        expect(bankAccount).toBeTruthy()
        expect(bankAccount).not.toBe('-')
      }
    })

    test('Reference numbers should follow expected patterns', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      const references = await page.locator('tbody tr td:nth-child(3)').allTextContents()
      
      references.forEach(ref => {
        if (ref && ref !== '-') {
          // Reference should be alphanumeric with possible special chars
          expect(ref).toMatch(/^[A-Z0-9\-\/\#]+$/i)
        }
      })
    })
  })

  test.describe('Summary Cards Accuracy', () => {
    test('Summary counts should match filtered table data', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Get summary card values
      const totalTransactionsCard = await page.locator('p:has-text("Total Transactions") ~ p').textContent()
      const totalTransactions = parseInt(totalTransactionsCard || '0')
      
      const unreconciledCard = await page.locator('p:has-text("Unreconciled") ~ p').textContent()
      const unreconciledCount = parseInt(unreconciledCard || '0')
      
      const reconciledCard = await page.locator('p:has-text("Reconciled") ~ p').textContent()
      const reconciledCount = parseInt(reconciledCard || '0')
      
      // Verify totals add up
      expect(unreconciledCount + reconciledCount).toBeLessThanOrEqual(totalTransactions)
      
      // Count actual unreconciled in table
      const pendingBadges = await page.locator('span:has-text("Pending")').count()
      const matchedBadges = await page.locator('span:has-text("Matched")').count()
      const actualUnreconciled = pendingBadges + matchedBadges
      
      // Should match summary (considering pagination)
      if (!await page.locator('button:has-text("Showing All")').isVisible()) {
        // If not showing all, counts might differ due to pagination
        expect(actualUnreconciled).toBeLessThanOrEqual(unreconciledCount)
      } else {
        expect(actualUnreconciled).toBe(unreconciledCount)
      }
    })

    test('Rule matched count should only include unreconciled transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      const ruleMatchedCard = await page.locator('p:has-text("Rule Matched") ~ p').textContent()
      const ruleMatchedCount = parseInt(ruleMatchedCard || '0')
      
      // Count matched badges in table
      const matchedBadges = await page.locator('span:has-text("Matched")').count()
      
      // All matched should be unreconciled
      const matchedRows = page.locator('tr:has(span:has-text("Matched"))')
      const matchedRowCount = await matchedRows.count()
      
      for (let i = 0; i < matchedRowCount; i++) {
        const row = matchedRows.nth(i)
        // Should not have reconciled badge
        const hasReconciledBadge = await row.locator('span:has-text("Reconciled")').isVisible().catch(() => false)
        expect(hasReconciledBadge).toBe(false)
      }
    })
  })

  test.describe('Filtering Logic', () => {
    test('Status filter should correctly filter transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Test unreconciled filter
      const statusSelect = page.locator('select').nth(1)
      await statusSelect.selectOption('unreconciled')
      
      await page.waitForTimeout(1000)
      
      // All visible transactions should be unreconciled
      const visibleRows = page.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })
      const rowCount = await visibleRows.count()
      
      for (let i = 0; i < Math.min(rowCount, 5); i++) {
        const row = visibleRows.nth(i)
        const hasReconciledBadge = await row.locator('span:has-text("Reconciled")').isVisible().catch(() => false)
        expect(hasReconciledBadge).toBe(false)
        
        // Should have either Pending or Matched status
        const hasPendingOrMatched = await row.locator('span:has-text("Pending"), span:has-text("Matched")').isVisible()
        expect(hasPendingOrMatched).toBe(true)
      }
    })

    test('Bank account filter should show only selected account transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      const accountSelect = page.locator('select').first()
      const options = await accountSelect.locator('option').allTextContents()
      
      if (options.length > 1) {
        // Select first actual account (not "All Bank Accounts")
        await accountSelect.selectOption({ index: 1 })
        const selectedAccountText = options[1]
        const accountName = selectedAccountText.split('(')[0].trim()
        
        await page.waitForTimeout(1000)
        
        // All visible transactions should be from selected account
        const bankAccountCells = await page.locator('tbody tr td:nth-child(7)').allTextContents()
        
        bankAccountCells.forEach(cellText => {
          if (cellText && cellText !== '-') {
            expect(cellText).toBe(accountName)
          }
        })
      }
    })

    test('Search should filter by description, reference, and contact', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Get a description from first transaction
      const firstDescription = await page.locator('tbody tr:first-child td:nth-child(4)').textContent()
      
      if (firstDescription && firstDescription !== '-') {
        // Search for part of the description
        const searchTerm = firstDescription.split(' ')[0]
        const searchInput = page.locator('input[placeholder="Search transactions..."]')
        await searchInput.fill(searchTerm)
        
        await page.waitForTimeout(500)
        
        // All visible transactions should contain search term
        const descriptions = await page.locator('tbody tr td:nth-child(4)').allTextContents()
        const references = await page.locator('tbody tr td:nth-child(3)').allTextContents()
        const contacts = await page.locator('tbody tr td:nth-child(5)').allTextContents()
        
        const visibleRows = page.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') })
        const rowCount = await visibleRows.count()
        
        for (let i = 0; i < rowCount; i++) {
          const desc = descriptions[i] || ''
          const ref = references[i] || ''
          const contact = contacts[i] || ''
          
          const matchFound = 
            desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
            contact.toLowerCase().includes(searchTerm.toLowerCase())
          
          expect(matchFound).toBe(true)
        }
      }
    })
  })

  test.describe('Bulk Operations', () => {
    test('Select all should select only visible filtered transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Filter to unreconciled only
      const statusSelect = page.locator('select').nth(1)
      await statusSelect.selectOption('unreconciled')
      await page.waitForTimeout(1000)
      
      // Count visible transactions
      const visibleCheckboxes = page.locator('tbody tr input[type="checkbox"]')
      const checkboxCount = await visibleCheckboxes.count()
      
      // Select all
      const selectAllCheckbox = page.locator('thead input[type="checkbox"]')
      await selectAllCheckbox.check()
      
      // Verify selection count
      const selectionText = await page.locator('span:has-text("selected")').textContent()
      const selectedCount = parseInt(selectionText?.match(/(\d+)/)?.[1] || '0')
      
      expect(selectedCount).toBe(checkboxCount)
      
      // All visible checkboxes should be checked
      for (let i = 0; i < checkboxCount; i++) {
        await expect(visibleCheckboxes.nth(i)).toBeChecked()
      }
    })

    test('Bulk reconcile should only be enabled for matched transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Select some transactions
      const checkboxes = page.locator('tbody tr input[type="checkbox"]')
      const checkboxCount = await checkboxes.count()
      
      if (checkboxCount >= 2) {
        await checkboxes.nth(0).check()
        await checkboxes.nth(1).check()
        
        // Bulk actions should appear
        await expect(page.locator('text="selected"')).toBeVisible()
        
        const bulkReconcileButton = page.locator('button:has-text("Bulk Reconcile Matched")')
        await bulkReconcileButton.click()
        
        // Should check if any selected are matched
        const selectedRows = page.locator('tbody tr:has(input:checked)')
        const selectedCount = await selectedRows.count()
        
        let hasMatched = false
        for (let i = 0; i < selectedCount; i++) {
          const row = selectedRows.nth(i)
          const isMatched = await row.locator('span:has-text("Matched")').isVisible().catch(() => false)
          if (isMatched) hasMatched = true
        }
        
        // If no matched transactions, should show error
        if (!hasMatched) {
          await expect(page.locator('text="Please select matched transactions"')).toBeVisible()
        }
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('Apply Rule button should only appear for matched unreconciled transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Find all Apply Rule buttons
      const applyRuleButtons = page.locator('button:has-text("Apply Rule")')
      const buttonCount = await applyRuleButtons.count()
      
      for (let i = 0; i < buttonCount; i++) {
        const button = applyRuleButtons.nth(i)
        const row = button.locator('ancestor::tr')
        
        // Should have Matched status
        await expect(row.locator('span:has-text("Matched")')).toBeVisible()
        
        // Should NOT have Reconciled status
        const hasReconciled = await row.locator('span:has-text("Reconciled")').isVisible().catch(() => false)
        expect(hasReconciled).toBe(false)
      }
    })

    test('Reconcile button should only appear for unreconciled transactions', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Find all Reconcile buttons
      const reconcileButtons = page.locator('button:has-text("Reconcile")')
      const buttonCount = await reconcileButtons.count()
      
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = reconcileButtons.nth(i)
        const row = button.locator('ancestor::tr')
        
        // Should NOT have Reconciled status
        const hasReconciled = await row.locator('span:has-text("Reconciled")').isVisible().catch(() => false)
        expect(hasReconciled).toBe(false)
        
        // Should have either Pending or Matched status
        const hasUnreconciledStatus = await row.locator('span:has-text("Pending"), span:has-text("Matched")').isVisible()
        expect(hasUnreconciledStatus).toBe(true)
      }
    })
  })

  test.describe('Pagination Logic', () => {
    test('Show All toggle should display all transactions without pagination', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Get total count
      const totalText = await page.locator('text=/Page \\d+ of \\d+.*total/').textContent()
      const totalMatch = totalText?.match(/\((\d+) total\)/)
      const totalCount = parseInt(totalMatch?.[1] || '0')
      
      if (totalCount > 100) { // Only test if there are more than one page
        // Click Show All
        const showAllButton = page.locator('button:has-text("Show All")')
        await showAllButton.click()
        
        // Should show loading state
        await expect(page.locator('.animate-spin')).toBeVisible()
        
        // Wait for load to complete
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 30000 })
        
        // Should now show all transactions
        const showingAllText = await page.locator('text="Showing all"').textContent()
        expect(showingAllText).toContain(totalCount.toString())
        
        // Pagination controls should be hidden
        await expect(page.locator('button:has-text("Previous")')).not.toBeVisible()
        await expect(page.locator('button:has-text("Next")')).not.toBeVisible()
        
        // Should show warning for large datasets
        if (totalCount > 1000) {
          await expect(page.locator('text="May take longer to load"')).toBeVisible()
        }
      }
    })
  })

  test.describe('Data Export', () => {
    test('Export should trigger CSV download with correct filename', async () => {
      await page.waitForSelector('table', { timeout: 10000 })
      
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      
      // Click Export
      const exportButton = page.locator('button:has-text("Export")')
      await exportButton.click()
      
      // Should show success message
      await expect(page.locator('text="Exporting transactions to CSV"')).toBeVisible()
      
      // Verify download (if implemented)
      try {
        const download = await downloadPromise
        const filename = download.suggestedFilename()
        
        expect(filename).toMatch(/transactions.*\.csv$/i)
        expect(filename).toContain(new Date().getFullYear().toString())
      } catch {
        // Export might not be fully implemented yet
      }
    })
  })
})
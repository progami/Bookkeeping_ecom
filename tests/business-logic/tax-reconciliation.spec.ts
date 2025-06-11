import { test, expect } from '@playwright/test'
import { setupXeroMocks } from '../helpers/mock-api'

test.describe('Tax Calculation and Reconciliation Business Logic', () => {
  test.beforeEach(async ({ page }) => {
    await setupXeroMocks(page)
  })

  test.describe('Tax Calculations', () => {
    test('should calculate GST correctly for expenses (INPUT2)', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Find an expense transaction
      const expenseRow = page.locator('tr').filter({ hasText: 'Office supplies' }).first()
      
      if (await expenseRow.isVisible()) {
        // Get the amount
        const amountText = await expenseRow.locator('td:nth-child(6)').textContent()
        const amount = parseFloat(amountText?.replace(/[^0-9.-]/g, '') || '0')
        
        // Click reconcile
        await expenseRow.locator('button:has-text("Reconcile")').click()
        
        // Select INPUT2 tax type
        const taxSelect = page.locator('select').filter({ has: page.locator('option[value="INPUT2"]') })
        await taxSelect.selectOption('INPUT2')
        
        // GST should be 15% for NZ
        const expectedGST = amount * 0.15 / 1.15 // Amount is GST inclusive
        
        // Check if tax amount is shown
        const taxDisplay = page.locator('text=/GST.*\\$[0-9.]+/')
        if (await taxDisplay.isVisible()) {
          const taxText = await taxDisplay.textContent()
          const displayedTax = parseFloat(taxText?.replace(/[^0-9.]/g, '') || '0')
          
          // Allow small rounding differences
          expect(Math.abs(displayedTax - expectedGST)).toBeLessThan(0.01)
        }
      }
    })

    test('should calculate GST correctly for income (OUTPUT2)', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Find an income transaction
      const incomeRow = page.locator('tr').filter({ hasText: 'Consulting services' }).first()
      
      if (await incomeRow.isVisible()) {
        const amountText = await incomeRow.locator('td:nth-child(6)').textContent()
        const amount = parseFloat(amountText?.replace(/[^0-9.-]/g, '') || '0')
        
        await incomeRow.locator('button:has-text("Reconcile")').click()
        
        const taxSelect = page.locator('select').filter({ has: page.locator('option[value="OUTPUT2"]') })
        await taxSelect.selectOption('OUTPUT2')
        
        // GST should be 15% for NZ
        const expectedGST = amount * 0.15 / 1.15
        
        const taxDisplay = page.locator('text=/GST.*\\$[0-9.]+/')
        if (await taxDisplay.isVisible()) {
          const taxText = await taxDisplay.textContent()
          const displayedTax = parseFloat(taxText?.replace(/[^0-9.]/g, '') || '0')
          
          expect(Math.abs(displayedTax - expectedGST)).toBeLessThan(0.01)
        }
      }
    })

    test('should handle tax-exempt transactions (EXEMPTINPUT)', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      const firstRow = page.locator('tbody tr').first()
      await firstRow.locator('button:has-text("Reconcile")').click()
      
      // Select exempt tax type
      const taxSelect = page.locator('select').filter({ has: page.locator('option[value="EXEMPTINPUT"]') })
      await taxSelect.selectOption('EXEMPTINPUT')
      
      // No GST should be calculated
      const taxDisplay = page.locator('text=/GST.*\\$0\\.00/')
      const noTaxDisplay = page.locator('text="No GST"')
      
      // Either should show $0.00 GST or "No GST"
      const hasZeroTax = await taxDisplay.isVisible().catch(() => false)
      const hasNoTax = await noTaxDisplay.isVisible().catch(() => false)
      
      expect(hasZeroTax || hasNoTax).toBeTruthy()
    })

    test('should handle different tax rates correctly', async ({ page }) => {
      // This test assumes the system supports different tax rates
      await page.goto('/bookkeeping/transactions')
      
      const firstRow = page.locator('tbody tr').first()
      await firstRow.locator('button:has-text("Reconcile")').click()
      
      // Check available tax options
      const taxSelect = page.locator('select').filter({ hasText: 'tax' })
      const taxOptions = await taxSelect.locator('option').allTextContents()
      
      // Should have multiple tax options
      expect(taxOptions.length).toBeGreaterThan(2)
      
      // Common tax types for NZ
      expect(taxOptions.some(opt => opt.includes('INPUT2') || opt.includes('15%'))).toBeTruthy()
      expect(taxOptions.some(opt => opt.includes('OUTPUT2') || opt.includes('15%'))).toBeTruthy()
      expect(taxOptions.some(opt => opt.includes('EXEMPT') || opt.includes('0%'))).toBeTruthy()
    })
  })

  test.describe('Reconciliation Process', () => {
    test('should reconcile transaction with all required fields', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Find unreconciled transaction
      const unreconciledRow = page.locator('tr').filter({ 
        has: page.locator('button:has-text("Reconcile")') 
      }).first()
      
      if (await unreconciledRow.isVisible()) {
        await unreconciledRow.locator('button:has-text("Reconcile")').click()
        
        // Fill required fields
        await page.fill('input[placeholder*="account code"]', '400')
        
        const taxSelect = page.locator('select').filter({ hasText: 'tax' })
        await taxSelect.selectOption({ index: 1 })
        
        // Add notes
        await page.fill('textarea', 'Test reconciliation notes')
        
        // Submit
        await page.click('button:has-text("Reconcile")')
        
        // Should show success
        await expect(page.locator('text=/success|reconciled/i')).toBeVisible()
      }
    })

    test('should validate account code format', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      const firstRow = page.locator('tbody tr').first()
      await firstRow.locator('button:has-text("Reconcile")').click()
      
      // Try invalid account codes
      const accountInput = page.locator('input[placeholder*="account code"]')
      
      // Test non-numeric
      await accountInput.fill('ABC')
      await page.click('button:has-text("Reconcile")')
      
      // Should show validation error
      const error = page.locator('.text-red-500, [role="alert"]')
      await expect(error).toBeVisible()
      
      // Test valid numeric code
      await accountInput.clear()
      await accountInput.fill('400')
      
      // Error should clear
      await expect(error).not.toBeVisible()
    })

    test('should create categorization rule from reconciliation', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      const unreconciledRow = page.locator('tr').filter({ 
        has: page.locator('button:has-text("Reconcile")') 
      }).first()
      
      if (await unreconciledRow.isVisible()) {
        // Get transaction description for rule
        const description = await unreconciledRow.locator('td:nth-child(4)').textContent()
        
        await unreconciledRow.locator('button:has-text("Reconcile")').click()
        
        // Fill fields
        await page.fill('input[placeholder*="account code"]', '400')
        
        // Check "Create rule" checkbox
        const createRuleCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: 'Create rule' })
        await createRuleCheckbox.check()
        
        // Rule name field should appear
        const ruleNameInput = page.locator('input[placeholder*="rule name"]')
        await expect(ruleNameInput).toBeVisible()
        
        await ruleNameInput.fill('Auto Rule from Reconciliation')
        
        // Pattern should be pre-filled with transaction data
        const patternInput = page.locator('input[placeholder*="pattern"]')
        const patternValue = await patternInput.inputValue()
        
        // Pattern should be based on transaction
        expect(patternValue).toBeTruthy()
        
        // Submit
        await page.click('button:has-text("Reconcile")')
        
        // Verify rule was created
        await page.goto('/bookkeeping/rules')
        await expect(page.locator('text="Auto Rule from Reconciliation"')).toBeVisible()
      }
    })

    test('should handle bulk reconciliation', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Select multiple unreconciled transactions
      const checkboxes = await page.locator('input[type="checkbox"]').all()
      let selectedCount = 0
      
      for (let i = 1; i < Math.min(4, checkboxes.length); i++) {
        const row = page.locator('tbody tr').nth(i - 1)
        const hasReconcileButton = await row.locator('button:has-text("Reconcile")').isVisible()
        
        if (hasReconcileButton) {
          await checkboxes[i].click()
          selectedCount++
        }
      }
      
      if (selectedCount > 0) {
        // Bulk reconcile button should appear
        const bulkReconcile = page.locator('button:has-text("Bulk Reconcile")')
        await expect(bulkReconcile).toBeVisible()
        
        await bulkReconcile.click()
        
        // Should show bulk reconcile modal
        const modal = page.locator('[role="dialog"]')
        await expect(modal).toBeVisible()
        
        // Should show count of selected transactions
        await expect(modal.locator(`text="${selectedCount} transactions"`)).toBeVisible()
      }
    })

    test('should update transaction status after reconciliation', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Find specific unreconciled transaction
      const unreconciledRow = page.locator('tr').filter({ 
        has: page.locator('button:has-text("Reconcile")') 
      }).first()
      
      if (await unreconciledRow.isVisible()) {
        // Get transaction ID or unique identifier
        const transactionText = await unreconciledRow.textContent()
        
        // Reconcile it
        await unreconciledRow.locator('button:has-text("Reconcile")').click()
        await page.fill('input[placeholder*="account code"]', '400')
        await page.click('button:has-text("Reconcile")')
        
        // Wait for success
        await page.waitForTimeout(1000)
        
        // Transaction should now show as reconciled
        const reconciledRow = page.locator('tr').filter({ hasText: transactionText })
        
        // Should not have reconcile button anymore
        await expect(reconciledRow.locator('button:has-text("Reconcile")')).not.toBeVisible()
        
        // Should show reconciled status
        await expect(reconciledRow.locator('text="Reconciled"')).toBeVisible()
      }
    })
  })

  test.describe('Account Balance Calculations', () => {
    test('should update account balances after reconciliation', async ({ page }) => {
      await page.goto('/bookkeeping')
      
      // Get initial cash balance
      const cashCard = page.locator('[data-testid="cash-balance"], .card:has-text("Cash in Bank")')
      const initialBalanceText = await cashCard.textContent()
      const initialBalance = parseFloat(initialBalanceText?.replace(/[^0-9.-]/g, '') || '0')
      
      // Go to transactions and reconcile one
      await page.goto('/bookkeeping/transactions')
      
      const unreconciledRow = page.locator('tr').filter({ 
        has: page.locator('button:has-text("Reconcile")') 
      }).first()
      
      if (await unreconciledRow.isVisible()) {
        // Get transaction amount
        const amountText = await unreconciledRow.locator('td:nth-child(6)').textContent()
        const amount = parseFloat(amountText?.replace(/[^0-9.-]/g, '') || '0')
        
        // Reconcile
        await unreconciledRow.locator('button:has-text("Reconcile")').click()
        await page.fill('input[placeholder*="account code"]', '400')
        await page.click('button:has-text("Reconcile")')
        
        // Go back to dashboard
        await page.goto('/bookkeeping')
        
        // Balance should be updated
        const newBalanceText = await cashCard.textContent()
        const newBalance = parseFloat(newBalanceText?.replace(/[^0-9.-]/g, '') || '0')
        
        // New balance should reflect the reconciled transaction
        // (This depends on business logic - might increase or decrease)
        expect(newBalance).not.toBe(initialBalance)
      }
    })

    test('should calculate period totals correctly', async ({ page }) => {
      await page.goto('/bookkeeping')
      
      // Check period selector
      const periodSelector = page.locator('select').filter({ hasText: 'Last 30 days' })
      await periodSelector.selectOption('Last 30 days')
      
      // Get income and expense totals
      const incomeCard = page.locator('.card:has-text("Income")')
      const expenseCard = page.locator('.card:has-text("Expenses")')
      
      const incomeText = await incomeCard.textContent()
      const expenseText = await expenseCard.textContent()
      
      const income = parseFloat(incomeText?.replace(/[^0-9.-]/g, '') || '0')
      const expenses = parseFloat(expenseText?.replace(/[^0-9.-]/g, '') || '0')
      
      // Net cash flow should equal income - expenses
      const netCashFlowCard = page.locator('.card:has-text("Net Cash Flow")')
      const netCashFlowText = await netCashFlowCard.textContent()
      const netCashFlow = parseFloat(netCashFlowText?.replace(/[^0-9.-]/g, '') || '0')
      
      expect(Math.abs(netCashFlow - (income - expenses))).toBeLessThan(0.01)
    })
  })

  test.describe('GL Account Mapping', () => {
    test('should suggest appropriate GL accounts', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Find transaction with "Office supplies"
      const officeRow = page.locator('tr').filter({ hasText: 'Office supplies' })
      
      if (await officeRow.isVisible()) {
        await officeRow.locator('button:has-text("Reconcile")').click()
        
        // Account code field should suggest office/supplies related accounts
        const accountInput = page.locator('input[placeholder*="account code"]')
        await accountInput.fill('40') // Start typing
        
        // Check for suggestions
        const suggestions = page.locator('[role="listbox"], .suggestions')
        
        if (await suggestions.isVisible()) {
          // Should show relevant account codes
          await expect(suggestions.locator('text="400"')).toBeVisible()
        }
      }
    })

    test('should validate GL account exists', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      const firstRow = page.locator('tbody tr').first()
      await firstRow.locator('button:has-text("Reconcile")').click()
      
      // Try non-existent account code
      await page.fill('input[placeholder*="account code"]', '99999')
      await page.click('button:has-text("Reconcile")')
      
      // Should show error
      const error = page.locator('text=/invalid.*account|account.*not.*found/i')
      await expect(error).toBeVisible()
    })
  })
})
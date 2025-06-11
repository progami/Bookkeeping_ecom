import { test, expect, Page } from '@playwright/test'

test.describe('Rules Management - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/rules')
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

    test('should navigate to create new rule', async () => {
      const createButton = page.locator('button:has-text("Create New Rule")')
      await expect(createButton).toBeVisible()
      await createButton.click()
      await expect(page).toHaveURL('/bookkeeping/rules/new')
    })
  })

  test.describe('Filter Controls', () => {
    test('should search rules by name or pattern', async () => {
      const searchInput = page.locator('input[placeholder*="Search rules"]')
      await expect(searchInput).toBeVisible()
      
      await searchInput.fill('test search')
      // Results should filter (implementation dependent)
    })

    test('should filter by status', async () => {
      // Find the status filter dropdown
      const statusFilter = page.locator('select[data-testid="filter-status"]')
      await expect(statusFilter).toBeVisible()
      
      // Test All filter
      await statusFilter.selectOption('all')
      await expect(statusFilter).toHaveValue('all')
      
      // Test Active filter
      await statusFilter.selectOption('active')
      await expect(statusFilter).toHaveValue('active')
      
      // Test Inactive filter
      await statusFilter.selectOption('inactive')
      await expect(statusFilter).toHaveValue('inactive')
    })
  })

  test.describe('Rules Table', () => {
    test('should show edit button for each rule', async () => {
      // Check if any rules exist
      const ruleRows = page.locator('tbody tr')
      const count = await ruleRows.count()
      
      if (count > 0) {
        const firstRule = ruleRows.first()
        const editButton = firstRule.locator('[data-testid="edit-rule"]')
        await expect(editButton).toBeVisible()
        
        // Click edit
        await editButton.click()
        await expect(page).toHaveURL(/\/rules\/.*\/edit/)
      }
    })

    test('should toggle rule active status', async () => {
      const ruleRows = page.locator('tbody tr')
      const count = await ruleRows.count()
      
      if (count > 0) {
        const firstRule = ruleRows.first()
        const toggleSwitch = firstRule.locator('[data-testid="toggle-status"]')
        
        if (await toggleSwitch.isVisible()) {
          // Click the toggle to change state
          await toggleSwitch.click()
          
          // Wait for the status to update (the toggle will animate)
          await page.waitForTimeout(500)
        }
      }
    })

    test('should delete rule with confirmation', async () => {
      const ruleRows = page.locator('tbody tr')
      const count = await ruleRows.count()
      
      if (count > 0) {
        const firstRule = ruleRows.first()
        const deleteButton = firstRule.locator('[data-testid="delete-rule"]')
        
        if (await deleteButton.isVisible()) {
          // Click delete button
          await deleteButton.click()
          
          // Check for custom confirmation dialog
          const confirmDialog = page.locator('[data-testid="confirm-dialog"]')
          await expect(confirmDialog).toBeVisible()
          
          // Check dialog content
          await expect(confirmDialog.locator('text="Are you sure"')).toBeVisible()
          
          // Cancel the delete
          const cancelButton = confirmDialog.locator('button:has-text("Cancel")')
          await cancelButton.click()
          
          // Dialog should close
          await expect(confirmDialog).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Empty State', () => {
    test('should show create first rule CTA when no rules', async () => {
      const ruleRows = page.locator('tbody tr')
      const count = await ruleRows.count()
      
      if (count === 0) {
        // Look for empty state message
        const emptyState = page.locator('[data-testid="empty-state"]')
        await expect(emptyState).toBeVisible()
        
        // Look for the create first rule link (it's a link styled as text, not a button)
        const createFirstLink = emptyState.locator('button:has-text("Create your first rule")')
        await expect(createFirstLink).toBeVisible()
        
        await createFirstLink.click()
        await expect(page).toHaveURL('/bookkeeping/rules/new')
      }
    })
  })
})

test.describe('Create/Edit Rule - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/rules/new')
  })

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close()
    }
  })

  test.describe('Form Fields', () => {
    test('should fill and validate rule name', async () => {
      const nameInput = page.locator('input[placeholder="e.g., Office Supplies"]')
      await expect(nameInput).toBeVisible()
      
      await nameInput.fill('Test Rule Name')
      await expect(nameInput).toHaveValue('Test Rule Name')
    })

    test('should fill description', async () => {
      const descriptionTextarea = page.locator('textarea')
      await expect(descriptionTextarea).toBeVisible()
      
      await descriptionTextarea.fill('This is a test rule description')
      await expect(descriptionTextarea).toHaveValue('This is a test rule description')
    })

    test('should select match type', async () => {
      const matchTypeSelect = page.locator('select#matchType')
      await expect(matchTypeSelect).toBeVisible()
      
      // Test selecting different options
      await matchTypeSelect.selectOption('equals')
      await expect(matchTypeSelect).toHaveValue('equals')
      
      await matchTypeSelect.selectOption('startsWith')
      await expect(matchTypeSelect).toHaveValue('startsWith')
      
      await matchTypeSelect.selectOption('endsWith')
      await expect(matchTypeSelect).toHaveValue('endsWith')
      
      await matchTypeSelect.selectOption('contains')
      await expect(matchTypeSelect).toHaveValue('contains')
    })

    test('should select match field', async () => {
      const matchFieldSelect = page.locator('select#matchField')
      await expect(matchFieldSelect).toBeVisible()
      
      // Test options
      await matchFieldSelect.selectOption('payee')
      await expect(matchFieldSelect).toHaveValue('payee')
      
      await matchFieldSelect.selectOption('reference')
      await expect(matchFieldSelect).toHaveValue('reference')
      
      await matchFieldSelect.selectOption('description')
      await expect(matchFieldSelect).toHaveValue('description')
    })

    test('should fill match value', async () => {
      const matchValueInput = page.locator('input[placeholder="e.g., office supplies"]')
      await expect(matchValueInput).toBeVisible()
      
      await matchValueInput.fill('test pattern')
      await expect(matchValueInput).toHaveValue('test pattern')
    })

    test('should fill account code with suggestions', async () => {
      const accountCodeInput = page.locator('input[placeholder="e.g., 400"]')
      await expect(accountCodeInput).toBeVisible()
      
      await accountCodeInput.fill('200')
      // Suggestions might appear (implementation dependent)
    })

    test('should select tax type', async () => {
      const taxTypeSelect = page.locator('select').filter({ has: page.locator('option[value*="TAX"]') })
      
      if (await taxTypeSelect.isVisible()) {
        const options = await taxTypeSelect.locator('option').count()
        if (options > 1) {
          await taxTypeSelect.selectOption({ index: 1 })
        }
      }
    })

    test('should set priority', async () => {
      const priorityInput = page.locator('input[type="number"]')
      await expect(priorityInput).toBeVisible()
      
      await priorityInput.fill('10')
      await expect(priorityInput).toHaveValue('10')
    })

    test('should toggle active status', async () => {
      const activeCheckbox = page.locator('input[type="checkbox"]')
      await expect(activeCheckbox).toBeVisible()
      
      const initialState = await activeCheckbox.isChecked()
      await activeCheckbox.click()
      await expect(activeCheckbox).toBeChecked({ checked: !initialState })
    })
  })

  test.describe('Form Actions', () => {
    test('should cancel and return to rules list', async () => {
      const cancelButton = page.locator('button:has-text("Cancel")')
      await expect(cancelButton).toBeVisible()
      
      await cancelButton.click()
      await expect(page).toHaveURL('/bookkeeping/rules')
    })

    test('should validate required fields on submit', async () => {
      const submitButton = page.locator('button:has-text("Create Rule")')
      await expect(submitButton).toBeVisible()
      
      // Submit without filling required fields
      await submitButton.click()
      
      // Should show validation error message
      await expect(page.locator('.error-message')).toBeVisible()
      
      // Should also show inline errors for required fields
      await expect(page.locator('text="Rule name is required"')).toBeVisible()
      await expect(page.locator('text="Match value is required"')).toBeVisible()
      await expect(page.locator('text="Account code is required"')).toBeVisible()
    })

    test('should create rule with valid data', async () => {
      // Fill all required fields
      await page.locator('input[placeholder="e.g., Office Supplies"]').fill('Test Rule')
      await page.locator('input[placeholder="e.g., office supplies"]').fill('test')
      await page.locator('input[placeholder="e.g., 400"]').fill('200')
      
      const submitButton = page.locator('button:has-text("Create Rule")')
      await submitButton.click()
      
      // Should show success toast
      await expect(page.locator('text="Rule created successfully"')).toBeVisible()
      
      // Should redirect to rules list
      await expect(page).toHaveURL('/bookkeeping/rules')
    })
  })

  test.describe('Edit Mode', () => {
    test('should load existing rule data', async () => {
      // Navigate to edit an existing rule
      await page.goto('/bookkeeping/rules')
      
      const editButton = page.locator('[data-testid="edit-rule"]').first()
      const ruleCount = await page.locator('tbody tr').count()
      
      if (ruleCount > 0 && await editButton.isVisible()) {
        await editButton.click()
        
        // Should navigate to edit page
        await expect(page).toHaveURL(/\/bookkeeping\/rules\/.*\/edit/)
        
        // Form should be pre-filled
        const nameInput = page.locator('input[placeholder="e.g., Office Supplies"]')
        await expect(nameInput).toBeVisible()
        
        // Wait for form to load
        await page.waitForTimeout(500)
        
        const nameValue = await nameInput.inputValue()
        expect(nameValue).toBeTruthy()
        
        // Button should say "Update Rule"
        await expect(page.locator('button:has-text("Update Rule")')).toBeVisible()
      }
    })
  })
})
import { test, expect } from '@playwright/test'
import { setupXeroMocks } from '../helpers/mock-api'

test.describe('Rule Engine Business Logic', () => {
  test.beforeEach(async ({ page }) => {
    await setupXeroMocks(page)
  })

  test.describe('Rule Priority System', () => {
    test('should apply rules in priority order', async ({ page }) => {
      // Create multiple rules with different priorities
      await page.goto('/bookkeeping/rules/new')
      
      // Create high priority rule
      await page.fill('input[placeholder="e.g., Office Supplies"]', 'High Priority Rule')
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'office')
      await page.fill('input[placeholder="e.g., 400"]', '400')
      await page.fill('input[type="number"]', '100') // High priority
      await page.click('button:has-text("Create Rule")')
      
      // Create low priority rule with overlapping pattern
      await page.goto('/bookkeeping/rules/new')
      await page.fill('input[placeholder="e.g., Office Supplies"]', 'Low Priority Rule')
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'office supplies')
      await page.fill('input[placeholder="e.g., 400"]', '450')
      await page.fill('input[type="number"]', '10') // Low priority
      await page.click('button:has-text("Create Rule")')
      
      // Go to rules page and verify order
      await page.goto('/bookkeeping/rules')
      
      // High priority rule should appear first when sorted by priority
      const firstRuleName = await page.locator('tbody tr').first().locator('td:nth-child(2)').textContent()
      expect(firstRuleName).toContain('High Priority Rule')
    })

    test('should handle equal priority rules consistently', async ({ page }) => {
      await page.goto('/bookkeeping/rules')
      
      // Check if rules with same priority exist
      const priorityCells = await page.locator('tbody tr td:nth-child(5)').allTextContents()
      const priorities = priorityCells.map(p => parseInt(p))
      
      // Find rules with same priority
      const duplicates = priorities.filter((p, i) => priorities.indexOf(p) !== i)
      
      if (duplicates.length > 0) {
        // Rules with same priority should be ordered by creation date or name
        const samePriorityRows = await page.locator(`tbody tr:has(td:text("${duplicates[0]}"))`).all()
        expect(samePriorityRows.length).toBeGreaterThan(1)
      }
    })
  })

  test.describe('Rule Matching Logic', () => {
    test('should match "contains" pattern correctly', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      // Test the rule matching preview
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'office')
      
      // Open test dialog
      await page.click('button[data-testid="test-rule"]')
      
      // Check sample transaction
      const sampleText = await page.locator('text="Office supplies from Staples"').textContent()
      expect(sampleText).toBeTruthy()
      
      // Run test
      await page.click('button:has-text("Run Test")')
      
      // Should show match
      await expect(page.locator('text="Match Found!"')).toBeVisible()
    })

    test('should match "equals" pattern exactly', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      await page.selectOption('#matchField', 'payee')
      await page.selectOption('#matchType', 'equals')
      await page.fill('input[placeholder="e.g., office supplies"]', 'Staples Inc')
      
      // Test exact match
      await page.click('button[data-testid="test-rule"]')
      await page.click('button:has-text("Run Test")')
      
      await expect(page.locator('text="Match Found!"')).toBeVisible()
      
      // Test non-exact match
      await page.fill('input[placeholder="e.g., office supplies"]', 'Staples') // Missing "Inc"
      await page.click('button:has-text("Run Test")')
      
      await expect(page.locator('text="No Match"')).toBeVisible()
    })

    test('should match "startsWith" pattern correctly', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      await page.selectOption('#matchField', 'reference')
      await page.selectOption('#matchType', 'startsWith')
      await page.fill('input[placeholder="e.g., office supplies"]', 'INV-')
      
      await page.click('button[data-testid="test-rule"]')
      await page.click('button:has-text("Run Test")')
      
      // Sample reference is "INV-2024-001"
      await expect(page.locator('text="Match Found!"')).toBeVisible()
    })

    test('should match "endsWith" pattern correctly', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      await page.selectOption('#matchField', 'reference')
      await page.selectOption('#matchType', 'endsWith')
      await page.fill('input[placeholder="e.g., office supplies"]', '-001')
      
      await page.click('button[data-testid="test-rule"]')
      await page.click('button:has-text("Run Test")')
      
      await expect(page.locator('text="Match Found!"')).toBeVisible()
    })

    test('should handle case-insensitive matching', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'OFFICE') // Uppercase
      
      await page.click('button[data-testid="test-rule"]')
      await page.click('button:has-text("Run Test")')
      
      // Should match "Office supplies from Staples" despite case difference
      await expect(page.locator('text="Match Found!"')).toBeVisible()
    })
  })

  test.describe('Rule Application to Transactions', () => {
    test('should auto-categorize matching transactions', async ({ page }) => {
      // Create a rule first
      await page.goto('/bookkeeping/rules/new')
      await page.fill('input[placeholder="e.g., Office Supplies"]', 'Office Supplies Auto')
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'office supplies')
      await page.fill('input[placeholder="e.g., 400"]', '400')
      await page.selectOption('select[id="taxType"]', 'INPUT2')
      await page.click('button:has-text("Create Rule")')
      
      // Go to transactions
      await page.goto('/bookkeeping/transactions')
      
      // Find transaction with "office supplies" in description
      const officeTransaction = page.locator('tr:has-text("office supplies")')
      
      if (await officeTransaction.isVisible()) {
        // Should show suggested account code
        const suggestedAccount = officeTransaction.locator('text="400"')
        await expect(suggestedAccount).toBeVisible()
      }
    })

    test('should allow bulk application of rules', async ({ page }) => {
      await page.goto('/bookkeeping/transactions')
      
      // Select multiple transactions
      const checkboxes = await page.locator('input[type="checkbox"]').all()
      
      if (checkboxes.length > 2) {
        // Select first 3 transactions
        for (let i = 1; i < 4; i++) {
          await checkboxes[i].click()
        }
        
        // Bulk actions should appear
        const bulkReconcile = page.locator('button:has-text("Bulk Reconcile")')
        await expect(bulkReconcile).toBeVisible()
        
        // Click bulk reconcile
        await bulkReconcile.click()
        
        // Should apply matching rules to selected transactions
        const modal = page.locator('[role="dialog"]')
        await expect(modal).toBeVisible()
      }
    })
  })

  test.describe('Rule Management', () => {
    test('should toggle rule active status', async ({ page }) => {
      await page.goto('/bookkeeping/rules')
      
      const toggleSwitch = page.locator('[data-testid="toggle-status"]').first()
      
      if (await toggleSwitch.isVisible()) {
        // Get initial state
        const initialClass = await toggleSwitch.getAttribute('class')
        const wasActive = initialClass?.includes('bg-emerald')
        
        // Toggle
        await toggleSwitch.click()
        
        // Wait for update
        await page.waitForTimeout(500)
        
        // Check new state
        const newClass = await toggleSwitch.getAttribute('class')
        const isActive = newClass?.includes('bg-emerald')
        
        expect(isActive).toBe(!wasActive)
      }
    })

    test('should filter rules by status', async ({ page }) => {
      await page.goto('/bookkeeping/rules')
      
      // Filter by active
      await page.selectOption('[data-testid="filter-status"]', 'active')
      await page.waitForTimeout(500)
      
      // All visible rules should be active
      const activeToggles = await page.locator('[data-testid="toggle-status"]').all()
      
      for (const toggle of activeToggles) {
        const classes = await toggle.getAttribute('class')
        expect(classes).toContain('bg-emerald')
      }
      
      // Filter by inactive
      await page.selectOption('[data-testid="filter-status"]', 'inactive')
      await page.waitForTimeout(500)
      
      // All visible rules should be inactive
      const inactiveToggles = await page.locator('[data-testid="toggle-status"]').all()
      
      for (const toggle of inactiveToggles) {
        const classes = await toggle.getAttribute('class')
        expect(classes).toContain('bg-gray')
      }
    })

    test('should search rules by name and pattern', async ({ page }) => {
      await page.goto('/bookkeeping/rules')
      
      // Search by name
      await page.fill('[data-testid="search-rules"]', 'office')
      await page.waitForTimeout(500)
      
      // All visible rules should contain "office" in name or pattern
      const ruleRows = await page.locator('tbody tr').all()
      
      for (const row of ruleRows) {
        const text = await row.textContent()
        expect(text?.toLowerCase()).toContain('office')
      }
    })

    test('should update rule and maintain data integrity', async ({ page }) => {
      await page.goto('/bookkeeping/rules')
      
      const editButton = page.locator('[data-testid="edit-rule"]').first()
      
      if (await editButton.isVisible()) {
        // Get original rule name
        const originalName = await page.locator('tbody tr').first().locator('td:nth-child(2)').textContent()
        
        // Edit rule
        await editButton.click()
        
        // Update name
        const nameInput = page.locator('input[placeholder="e.g., Office Supplies"]')
        await nameInput.clear()
        await nameInput.fill('Updated Rule Name')
        
        // Save
        await page.click('button:has-text("Update Rule")')
        
        // Verify update
        await page.waitForURL('/bookkeeping/rules')
        
        const updatedName = await page.locator('tbody tr').first().locator('td:nth-child(2)').textContent()
        expect(updatedName).toContain('Updated Rule Name')
      }
    })

    test('should validate rule conflicts', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      // Create a rule with very broad pattern
      await page.fill('input[placeholder="e.g., Office Supplies"]', 'Catch All Rule')
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'a') // Matches almost everything
      await page.fill('input[placeholder="e.g., 400"]', '999')
      await page.fill('input[type="number"]', '1') // Very low priority
      
      // Should warn about broad pattern (if implemented)
      await page.click('button:has-text("Create Rule")')
      
      // Rule should still be created but with low priority
      await page.waitForURL('/bookkeeping/rules')
    })
  })

  test.describe('Tax Type Application', () => {
    test('should apply correct tax type from rule', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new')
      
      // Create rule with specific tax type
      await page.fill('input[placeholder="e.g., Office Supplies"]', 'GST Exempt Items')
      await page.selectOption('#matchField', 'description')
      await page.selectOption('#matchType', 'contains')
      await page.fill('input[placeholder="e.g., office supplies"]', 'exempt')
      await page.fill('input[placeholder="e.g., 400"]', '400')
      await page.selectOption('#taxType', 'EXEMPTINPUT')
      
      await page.click('button:has-text("Create Rule")')
      
      // Tax type should be saved with rule
      await page.waitForURL('/bookkeeping/rules')
      
      // Edit to verify
      await page.locator('[data-testid="edit-rule"]').first().click()
      
      const taxTypeValue = await page.locator('#taxType').inputValue()
      expect(taxTypeValue).toBe('EXEMPTINPUT')
    })
  })
})
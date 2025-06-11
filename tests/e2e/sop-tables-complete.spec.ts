import { test, expect, Page } from '@playwright/test'

test.describe('SOP Tables - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/sop-tables')
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

    test('should navigate to SOP Generator', async () => {
      const sopGeneratorButton = page.locator('button:has-text("Go to SOP Generator")')
      await expect(sopGeneratorButton).toBeVisible()
      await sopGeneratorButton.click()
      await expect(page).toHaveURL('/bookkeeping/sop-generator')
    })
  })

  test.describe('Year Toggle', () => {
    test('should switch between 2024 and 2025 data', async () => {
      const year2024Button = page.locator('button:has-text("2024")')
      const year2025Button = page.locator('button:has-text("2025")')
      
      await expect(year2024Button).toBeVisible()
      await expect(year2025Button).toBeVisible()
      
      // 2025 should be selected by default
      await expect(year2025Button).toHaveClass(/bg-indigo-600/)
      
      // Switch to 2024
      await year2024Button.click()
      await expect(year2024Button).toHaveClass(/bg-indigo-600/)
      await expect(year2025Button).not.toHaveClass(/bg-indigo-600/)
      
      // Verify year display changes
      await expect(page.locator('text=Manage Standard Operating Procedures for 2024')).toBeVisible()
      
      // Switch back to 2025
      await year2025Button.click()
      await expect(page.locator('text=Manage Standard Operating Procedures for 2025')).toBeVisible()
    })
  })

  test.describe('Account Selection', () => {
    test('should display account selector and handle selection', async () => {
      // Check account selector is visible
      const accountSelector = page.locator('select').filter({ hasText: 'Select an account to view/edit SOPs' })
      await expect(accountSelector).toBeVisible()
      
      // Select an account
      await accountSelector.selectOption({ index: 1 }) // Select first account
      
      // Should show table or empty state
      const tableOrEmpty = page.locator('table, text="No SOPs Defined"')
      await expect(tableOrEmpty).toBeVisible()
    })

    test('should show account cards when no account selected', async () => {
      // Should show grid of account cards
      const accountCards = page.locator('div[class*="grid"] > div[class*="cursor-pointer"]')
      const count = await accountCards.count()
      expect(count).toBeGreaterThan(0)
      
      // Click on first account card
      const firstCard = accountCards.first()
      await firstCard.click()
      
      // Account selector should update
      const accountSelector = page.locator('select')
      const selectedValue = await accountSelector.inputValue()
      expect(selectedValue).not.toBe('')
    })
  })

  test.describe('Export Functionality', () => {
    test('should export table to JSON', async () => {
      const exportButton = page.locator('button:has-text("Export")')
      await expect(exportButton).toBeVisible()
      
      // Set up download promise
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      // Verify download
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('sop-data')
      expect(download.suggestedFilename()).toContain('.json')
    })
  })

  test.describe('Table Interactions', () => {
    test('should add and edit SOP entries', async () => {
      // Select an account first
      const accountSelector = page.locator('select')
      await accountSelector.selectOption({ index: 1 })
      
      // Add new SOP button should appear
      const addButton = page.locator('button:has-text("Add New SOP")')
      await expect(addButton).toBeVisible()
      
      // Click add button
      await addButton.click()
      
      // New row should appear with input fields
      const serviceTypeInput = page.locator('input[placeholder="Service type"]')
      await expect(serviceTypeInput).toBeVisible()
      
      // Fill in required fields
      await serviceTypeInput.fill('Test Service')
      await page.locator('input[placeholder*="<Invoice#>"]').fill('<Invoice#>-TEST')
      await page.locator('input[placeholder*="<Department>"]').fill('<Department> Test')
      
      // Save button should be visible
      const saveButton = page.locator('button[title="Save"]')
      await expect(saveButton).toBeVisible()
    })

    test('should handle table edit actions', async () => {
      // Select an account
      const accountSelector = page.locator('select')
      await accountSelector.selectOption({ index: 1 })
      
      // Check if edit and delete buttons exist in table rows
      const editButtons = page.locator('button[title="Edit"]')
      const deleteButtons = page.locator('button[title="Delete"]')
      
      // If there are existing rows, buttons should be visible
      const tableRows = page.locator('tbody tr')
      const rowCount = await tableRows.count()
      
      if (rowCount > 0) {
        expect(await editButtons.count()).toBeGreaterThan(0)
        expect(await deleteButtons.count()).toBeGreaterThan(0)
      }
    })
  })

  test.describe('Table Content', () => {
    test('should display account grid when no account selected', async () => {
      // Should show account cards in grid
      const accountGrid = page.locator('div[class*="grid"]').first()
      await expect(accountGrid).toBeVisible()
      
      // Account cards should contain account names
      const accountCards = accountGrid.locator('> div')
      const count = await accountCards.count()
      expect(count).toBeGreaterThan(0)
      
      // First card should have account name
      const firstCard = accountCards.first()
      const accountName = await firstCard.locator('h3').textContent()
      expect(accountName).toBeTruthy()
    })

    test('should display SOP table when account selected', async () => {
      // Select an account
      const accountSelector = page.locator('select')
      await accountSelector.selectOption({ index: 1 })
      
      // Table or empty state should be visible
      const table = page.locator('table')
      const emptyState = page.locator('text="No SOPs Defined"')
      
      // One of them should be visible
      const tableVisible = await table.isVisible().catch(() => false)
      const emptyVisible = await emptyState.isVisible().catch(() => false)
      
      expect(tableVisible || emptyVisible).toBeTruthy()
    })
  })

  test.describe('Empty States', () => {
    test('should show empty state for account with no SOPs', async () => {
      // We need to find an account that might be empty
      // First get all account options
      const accountSelector = page.locator('select')
      const options = await accountSelector.locator('option').all()
      
      // Try each account until we find one that's empty or just test the UI
      if (options.length > 1) {
        // Select last account (more likely to be empty)
        await accountSelector.selectOption({ index: options.length - 1 })
        
        // Check for empty state or table
        const emptyState = page.locator('text="No SOPs Defined"')
        const table = page.locator('table')
        
        // One should be visible
        const emptyVisible = await emptyState.isVisible().catch(() => false)
        const tableVisible = await table.isVisible().catch(() => false)
        
        expect(emptyVisible || tableVisible).toBeTruthy()
      }
    })
  })

  test.describe('Responsive Design', () => {
    test('should adapt table for mobile view', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      
      // Table should still be scrollable
      const tableContainer = page.locator('.overflow-x-auto')
      await expect(tableContainer).toBeVisible()
      
      // Controls should be accessible
      const searchInput = page.locator('input[placeholder="Search SOP data..."]')
      await expect(searchInput).toBeVisible()
      
      const exportButton = page.locator('button:has-text("Export to CSV")')
      await expect(exportButton).toBeVisible()
    })

    test('should maintain functionality on tablet view', async () => {
      await page.setViewportSize({ width: 768, height: 1024 })
      
      // All elements should be visible and functional
      const year2025Button = page.locator('button:has-text("2025")')
      await expect(year2025Button).toBeVisible()
      
      const table = page.locator('table')
      await expect(table).toBeVisible()
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should allow keyboard navigation through controls', async () => {
      // Focus on search input
      const searchInput = page.locator('input[placeholder="Search SOP data..."]')
      await searchInput.focus()
      
      // Tab to next element
      await page.keyboard.press('Tab')
      
      // Should focus on export button
      const exportButton = page.locator('button:has-text("Export to CSV")')
      await expect(exportButton).toBeFocused()
    })
  })
})
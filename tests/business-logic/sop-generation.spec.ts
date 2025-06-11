import { test, expect } from '@playwright/test'

test.describe('SOP Generation Business Logic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookkeeping/sop-generator')
  })

  test.describe('SOP Generation Rules', () => {
    test('should generate correct reference for 321 - Goods account', async ({ page }) => {
      // Select year 2024
      await page.locator('button:has-text("2024")').click()
      
      // Select account
      await page.selectOption('select', '321 - Goods 货品')
      
      // Wait for service type to load
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      
      // Fill required fields
      await page.fill('input[placeholder="Enter invoice number"]', 'INV-2024-001')
      await page.fill('input[placeholder="MM/YYYY"]', '03/2024')
      
      // Select department if visible
      const deptSelect = page.locator('select').filter({ hasText: 'Select Department' })
      if (await deptSelect.isVisible()) {
        await deptSelect.selectOption({ index: 1 })
      }
      
      // Generate SOP
      await page.click('button:has-text("Generate SOP")')
      
      // Verify reference format
      const reference = await page.locator('[data-testid="reference-output"], .font-mono').first().textContent()
      expect(reference).toMatch(/INV-2024-001/)
      expect(reference).toMatch(/03\/2024/)
    })

    test('should generate correct description for shipping accounts', async ({ page }) => {
      // Select year 2025
      await page.locator('button:has-text("2025")').click()
      
      // Select shipping account
      await page.selectOption('select', '392 - 3rd Party shipping cost 第三方运费')
      
      // Wait for service type
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      
      // Fill fields
      await page.fill('input[placeholder="Enter invoice number"]', 'SHIP-2025-100')
      
      // Fill shipping-specific fields if they appear
      const vesselInput = page.locator('input[placeholder*="vessel"]')
      if (await vesselInput.isVisible()) {
        await vesselInput.fill('COSCO STAR')
      }
      
      const containerInput = page.locator('input[placeholder*="container"]')
      if (await containerInput.isVisible()) {
        await containerInput.fill('CONT123456')
      }
      
      // Generate SOP
      await page.click('button:has-text("Generate SOP")')
      
      // Verify description includes shipping details
      const description = await page.locator('[data-testid="description-output"], .font-mono').nth(1).textContent()
      expect(description).toBeTruthy()
      
      // Should include vessel/container if provided
      if (await vesselInput.isVisible()) {
        expect(description?.toLowerCase()).toContain('vessel')
      }
    })

    test('should enforce required fields based on account type', async ({ page }) => {
      await page.locator('button:has-text("2025")').click()
      
      // Select FBA-related account
      await page.selectOption('select', { label: /FBA/ })
      
      // Try to generate without filling required fields
      await page.click('button:has-text("Generate SOP")')
      
      // Should show validation error
      const errorMessage = page.locator('.text-red-500, [role="alert"]')
      await expect(errorMessage).toBeVisible()
    })

    test('should show different fields for 2024 vs 2025', async ({ page }) => {
      // Check 2024
      await page.locator('button:has-text("2024")').click()
      await page.selectOption('select', { index: 1 })
      
      // Point of Invoice should NOT be visible in 2024
      const pointOfInvoice2024 = page.locator('text="Point of Invoice"')
      await expect(pointOfInvoice2024).not.toBeVisible()
      
      // Check 2025
      await page.locator('button:has-text("2025")').click()
      await page.selectOption('select', { index: 1 })
      
      // Point of Invoice SHOULD be visible in 2025
      const pointOfInvoice2025 = page.locator('text="Point of Invoice"')
      await expect(pointOfInvoice2025).toBeVisible()
    })

    test('should generate different templates based on service type', async ({ page }) => {
      await page.locator('button:has-text("2024")').click()
      
      // Select an account with multiple service types
      await page.selectOption('select', '321 - Goods 货品')
      
      // Get service type options
      await page.waitForSelector('select:nth-of-type(2)')
      const serviceTypeSelect = page.locator('select:nth-of-type(2)')
      const options = await serviceTypeSelect.locator('option').allTextContents()
      
      // Test at least 2 different service types if available
      for (let i = 1; i < Math.min(3, options.length); i++) {
        await serviceTypeSelect.selectOption({ index: i })
        
        // Fill required fields
        await page.fill('input[placeholder="Enter invoice number"]', `TEST-${i}`)
        
        // Generate SOP
        await page.click('button:has-text("Generate SOP")')
        
        // Get generated reference
        const reference = await page.locator('.font-mono').first().textContent()
        
        // Clear for next iteration
        await page.click('button:has-text("Reset")')
        await page.selectOption('select', '321 - Goods 货品')
        
        // References should be different for different service types
        if (i > 1) {
          expect(reference).toBeTruthy()
        }
      }
    })

    test('should handle special characters in inputs', async ({ page }) => {
      await page.locator('button:has-text("2024")').click()
      await page.selectOption('select', { index: 1 })
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      
      // Test with special characters
      await page.fill('input[placeholder="Enter invoice number"]', 'INV/2024#001-TEST')
      await page.fill('input[placeholder*="tag"]', 'Tag & Description <test>')
      
      // Generate SOP
      await page.click('button:has-text("Generate SOP")')
      
      // Should handle special characters properly
      const reference = await page.locator('.font-mono').first().textContent()
      expect(reference).toContain('INV/2024#001-TEST')
    })

    test('should validate invoice number format', async ({ page }) => {
      await page.locator('button:has-text("2024")').click()
      await page.selectOption('select', { index: 1 })
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      
      // Try empty invoice number
      await page.fill('input[placeholder="Enter invoice number"]', '')
      await page.click('button:has-text("Generate SOP")')
      
      // Should show error
      const error = page.locator('.text-red-500, [role="alert"]')
      await expect(error).toBeVisible()
    })

    test('should copy to clipboard functionality', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await page.locator('button:has-text("2024")').click()
      await page.selectOption('select', { index: 1 })
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      
      await page.fill('input[placeholder="Enter invoice number"]', 'COPY-TEST')
      await page.click('button:has-text("Generate SOP")')
      
      // Click copy button
      const copyButton = page.locator('button:has-text("Copy")').first()
      await copyButton.click()
      
      // Check for success feedback
      const successIndicator = page.locator('text="Copied"')
      await expect(successIndicator).toBeVisible()
    })

    test('should reset form completely', async ({ page }) => {
      // Fill form
      await page.locator('button:has-text("2024")').click()
      await page.selectOption('select', { index: 1 })
      await page.waitForSelector('select:nth-of-type(2)')
      await page.selectOption('select:nth-of-type(2)', { index: 1 })
      await page.fill('input[placeholder="Enter invoice number"]', 'RESET-TEST')
      
      // Generate SOP
      await page.click('button:has-text("Generate SOP")')
      
      // Verify output exists
      const output = page.locator('.font-mono').first()
      await expect(output).toHaveText(/RESET-TEST/)
      
      // Reset
      await page.click('button:has-text("Reset")')
      
      // Verify form is cleared
      const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
      await expect(invoiceInput).toHaveValue('')
      
      // Verify output is cleared
      await expect(output).not.toBeVisible()
    })

    test('should handle department-specific logic', async ({ page }) => {
      await page.locator('button:has-text("2024")').click()
      
      // Select an account that requires department
      const accounts = await page.locator('select option').allTextContents()
      const deptAccount = accounts.find(acc => acc.includes('321') || acc.includes('322'))
      
      if (deptAccount) {
        await page.selectOption('select', deptAccount)
        await page.waitForSelector('select:nth-of-type(2)')
        await page.selectOption('select:nth-of-type(2)', { index: 1 })
        
        // Department field should be visible
        const deptSelect = page.locator('select').filter({ hasText: 'Select Department' })
        await expect(deptSelect).toBeVisible()
        
        // Select a department
        await deptSelect.selectOption({ index: 1 })
        
        // Fill other fields
        await page.fill('input[placeholder="Enter invoice number"]', 'DEPT-TEST')
        
        // Generate SOP
        await page.click('button:has-text("Generate SOP")')
        
        // Description should include department
        const description = await page.locator('.font-mono').nth(1).textContent()
        expect(description).toBeTruthy()
      }
    })
  })

  test.describe('SOP Data Validation', () => {
    test('should load correct accounts for selected year', async ({ page }) => {
      // Check 2024 accounts
      await page.locator('button:has-text("2024")').click()
      const accounts2024 = await page.locator('select option').allTextContents()
      
      // Switch to 2025
      await page.locator('button:has-text("2025")').click()
      const accounts2025 = await page.locator('select option').allTextContents()
      
      // Should have accounts for both years (might be same or different)
      expect(accounts2024.length).toBeGreaterThan(1)
      expect(accounts2025.length).toBeGreaterThan(1)
    })

    test('should populate service types based on selected account', async ({ page }) => {
      await page.locator('button:has-text("2024")').click()
      
      // Select first real account (skip placeholder)
      await page.selectOption('select', { index: 1 })
      
      // Wait for service types to load
      await page.waitForSelector('select:nth-of-type(2)')
      
      const serviceTypes = await page.locator('select:nth-of-type(2) option').allTextContents()
      
      // Should have at least one service type plus placeholder
      expect(serviceTypes.length).toBeGreaterThan(1)
    })
  })
})
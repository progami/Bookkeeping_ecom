import { test, expect } from '@playwright/test'

test.describe('SOP Generator', () => {
  test('should load and interact with dropdowns', async ({ page }) => {
    // Navigate to the page
    await page.goto('/bookkeeping/sop-generator')
    
    // Wait for the page to load
    await expect(page).toHaveTitle(/Bookkeeping/)
    await expect(page.locator('h1')).toContainText('SOP Generator')
    
    // Check if the account dropdown is visible and can be clicked
    const accountSelect = page.locator('select').filter({ hasText: 'Select Account' }).first()
    await expect(accountSelect).toBeVisible()
    
    // Try selecting an account
    await accountSelect.selectOption('321 - Contract Salaries')
    await page.waitForTimeout(1000) // Wait for service types to load
    
    // Check if service type dropdown appears
    const serviceTypeSelect = page.locator('select').filter({ hasText: 'Select Service Type' })
    const serviceTypeCount = await serviceTypeSelect.count()
    console.log('Service type selects found:', serviceTypeCount)
    
    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Console error:', msg.text())
      }
    })
    
    // Check for any page errors
    page.on('pageerror', err => {
      console.error('Page error:', err.message)
    })
    
    // Try to interact with other inputs
    const invoiceInput = page.getByPlaceholder('Enter invoice number')
    await expect(invoiceInput).toBeVisible()
    await invoiceInput.fill('TEST123')
    
    // Check if the value was set
    await expect(invoiceInput).toHaveValue('TEST123')
    
    // Test year selection buttons
    const year2024Button = page.getByRole('button', { name: '2024' })
    await expect(year2024Button).toBeVisible()
    await year2024Button.click()
    
    // Verify button state changed
    await expect(year2024Button).toHaveClass(/bg-emerald-600/)
    
    // Test adding a line item
    const addLineButton = page.getByRole('button', { name: /Add Line Item/i })
    await expect(addLineButton).toBeVisible()
    await addLineButton.click()
    
    // Check if a second row was added
    const tableRows = page.locator('tbody tr')
    await expect(tableRows).toHaveCount(2)
  })
})
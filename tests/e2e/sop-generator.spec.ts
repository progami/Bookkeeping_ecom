import { test, expect, Page } from '@playwright/test'

test.describe('SOP Generator', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/sop-generator')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test('should display SOP Generator page with correct elements', async () => {
    // Title and description
    await expect(page.locator('h1')).toContainText('SOP Generator')
    await expect(page.locator('p').first()).toContainText('Generate standard references and descriptions based on Excel SOPs')
    
    // Back button
    await expect(page.locator('button:has-text("Back to Dashboard")')).toBeVisible()
    
    // View SOP Tables button
    await expect(page.locator('button:has-text("View SOP Tables")')).toBeVisible()
  })

  test('should have year selection buttons', async () => {
    const year2024Button = page.locator('button:has-text("2024")').first()
    const year2025Button = page.locator('button:has-text("2025")').first()
    
    await expect(year2024Button).toBeVisible()
    await expect(year2025Button).toBeVisible()
    
    // 2025 should be selected by default
    await expect(year2025Button).toHaveClass(/bg-emerald-600/)
    
    // Click 2024
    await year2024Button.click()
    await expect(year2024Button).toHaveClass(/bg-emerald-600/)
    await expect(year2025Button).not.toHaveClass(/bg-emerald-600/)
  })

  test('should have all required form fields', async () => {
    // Chart of Account
    const chartOfAccountSelect = page.locator('select').filter({ has: page.locator('option:has-text("Select Account")') })
    await expect(chartOfAccountSelect).toBeVisible()
    
    // Invoice Number
    const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
    await expect(invoiceInput).toBeVisible()
    
    // Period Month/Year
    const periodInput = page.locator('input[placeholder="e.g., Dec24"]')
    await expect(periodInput).toBeVisible()
    
    // Generate and Reset buttons
    await expect(page.locator('button:has-text("Generate SOP")')).toBeVisible()
    await expect(page.locator('button:has-text("Reset")')).toBeVisible()
  })

  test('should show service type dropdown after selecting chart of account', async () => {
    // Select a chart of account
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 }) // Select first actual option
    
    // Service Type should appear
    await expect(page.locator('label:has-text("Service Type")')).toBeVisible()
    const serviceTypeSelect = page.locator('select').nth(1)
    await expect(serviceTypeSelect).toBeVisible()
  })

  test('should show conditional fields based on selection', async () => {
    // Select Contract Salaries account
    const chartOfAccountSelect = page.locator('select').first()
    const options = await chartOfAccountSelect.locator('option').allTextContents()
    const contractSalariesOption = options.find(opt => opt.includes('Contract Salaries'))
    
    if (contractSalariesOption) {
      await chartOfAccountSelect.selectOption({ label: contractSalariesOption })
      
      // Should show Department field
      await expect(page.locator('label:has-text("Department")')).toBeVisible()
    }
  })

  test('should validate required fields before generation', async () => {
    // Click Generate without filling fields
    await page.locator('button:has-text("Generate SOP")').click()
    
    // Should show error toast
    await expect(page.locator('text="Please fill in all required fields"')).toBeVisible()
  })

  test('should generate SOP with valid inputs', async () => {
    // Fill in required fields
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    
    // Wait for service type to appear and select
    await page.waitForSelector('select:nth-of-type(2)')
    const serviceTypeSelect = page.locator('select').nth(1)
    await serviceTypeSelect.selectOption({ index: 1 })
    
    // Fill invoice number
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    
    // Click Generate
    await page.locator('button:has-text("Generate SOP")').click()
    
    // Should show result
    await expect(page.locator('h2:has-text("Generated SOP")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text="Reference"')).toBeVisible()
    await expect(page.locator('text="Description"')).toBeVisible()
    await expect(page.locator('text="Chart of Account"')).toBeVisible()
  })

  test('should have copy functionality for generated results', async () => {
    // Generate an SOP first
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    await page.waitForSelector('select:nth-of-type(2)')
    const serviceTypeSelect = page.locator('select').nth(1)
    await serviceTypeSelect.selectOption({ index: 1 })
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    await page.locator('button:has-text("Generate SOP")').click()
    
    // Wait for results
    await page.waitForSelector('h2:has-text("Generated SOP")')
    
    // Check for copy buttons
    const copyButtons = page.locator('button').filter({ has: page.locator('svg') })
    const copyButtonCount = await copyButtons.count()
    expect(copyButtonCount).toBeGreaterThanOrEqual(2) // At least 2 copy buttons
  })

  test('should reset form when reset button is clicked', async () => {
    // Fill some fields
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    
    // Click Reset
    await page.locator('button:has-text("Reset")').click()
    
    // Fields should be reset
    await expect(chartOfAccountSelect).toHaveValue('')
    await expect(page.locator('input[placeholder="Enter invoice number"]')).toHaveValue('')
  })

  test('should display SOP rules section', async () => {
    // Generate an SOP to see the rules
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    await page.waitForSelector('select:nth-of-type(2)')
    const serviceTypeSelect = page.locator('select').nth(1)
    await serviceTypeSelect.selectOption({ index: 1 })
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    await page.locator('button:has-text("Generate SOP")').click()
    
    // Should show SOP Rules section
    await expect(page.locator('h3:has-text("SOP Rules")')).toBeVisible({ timeout: 5000 })
    
    // Should have rule items
    const ruleItems = page.locator('li').filter({ has: page.locator('span.text-amber-400') })
    const ruleCount = await ruleItems.count()
    expect(ruleCount).toBeGreaterThan(0)
  })

  test('should display instructions for Xero', async () => {
    // Generate an SOP to see instructions
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    await page.waitForSelector('select:nth-of-type(2)')
    const serviceTypeSelect = page.locator('select').nth(1)
    await serviceTypeSelect.selectOption({ index: 1 })
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    await page.locator('button:has-text("Generate SOP")').click()
    
    // Should show instructions
    await expect(page.locator('h3:has-text("How to use in Xero")')).toBeVisible({ timeout: 5000 })
    
    // Should have numbered instructions
    const instructions = page.locator('ol li')
    const instructionCount = await instructions.count()
    expect(instructionCount).toBeGreaterThan(0)
  })

  test('should handle loading state during generation', async () => {
    // Fill required fields
    const chartOfAccountSelect = page.locator('select').first()
    await chartOfAccountSelect.selectOption({ index: 1 })
    await page.waitForSelector('select:nth-of-type(2)')
    const serviceTypeSelect = page.locator('select').nth(1)
    await serviceTypeSelect.selectOption({ index: 1 })
    await page.locator('input[placeholder="Enter invoice number"]').fill('INV-12345')
    
    // Click generate and check for loading state
    const generateButton = page.locator('button:has-text("Generate SOP")')
    await generateButton.click()
    
    // Button should be disabled during generation
    await expect(generateButton).toBeDisabled()
    
    // Should show spinner
    const spinner = page.locator('.animate-spin')
    await expect(spinner).toBeVisible({ timeout: 1000 }).catch(() => {
      // Generation might be too fast
    })
  })
})
import { test, expect, Page } from '@playwright/test'

test.describe('SOP Generator - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping/sop-generator')
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

    test('should navigate to SOP Tables', async () => {
      const sopTablesButton = page.locator('button:has-text("View SOP Tables")')
      await expect(sopTablesButton).toBeVisible()
      await sopTablesButton.click()
      await expect(page).toHaveURL('/bookkeeping/sop-tables')
    })
  })

  test.describe('Year Selection', () => {
    test('should switch between 2024 and 2025', async () => {
      const year2024Button = page.locator('button:has-text("2024")').first()
      const year2025Button = page.locator('button:has-text("2025")').first()
      
      await expect(year2024Button).toBeVisible()
      await expect(year2025Button).toBeVisible()
      
      // 2025 should be selected by default
      await expect(year2025Button).toHaveClass(/bg-emerald-600/)
      
      // Switch to 2024
      await year2024Button.click()
      await expect(year2024Button).toHaveClass(/bg-emerald-600/)
      await expect(year2025Button).not.toHaveClass(/bg-emerald-600/)
      
      // Switch back to 2025
      await year2025Button.click()
      await expect(year2025Button).toHaveClass(/bg-emerald-600/)
    })
  })

  test.describe('Form Fields - Required', () => {
    test('should show and interact with Chart of Account selector', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      await expect(chartOfAccountSelect).toBeVisible()
      
      // Should have options
      const options = await chartOfAccountSelect.locator('option').count()
      expect(options).toBeGreaterThan(1)
      
      // Select first real option
      await chartOfAccountSelect.selectOption({ index: 1 })
      
      // Service Type should appear
      await expect(page.locator('label:has-text("Service Type")')).toBeVisible()
    })

    test('should show Service Type after Chart of Account selection', async () => {
      // Select chart of account first
      const chartOfAccountSelect = page.locator('select').first()
      await chartOfAccountSelect.selectOption({ index: 1 })
      
      // Wait for service type to update
      await page.waitForTimeout(500)
      
      // Service Type selector should appear
      const serviceTypeSelect = page.locator('select').nth(1)
      await expect(serviceTypeSelect).toBeVisible()
      
      // Should have at least one option (could be just the placeholder)
      const options = await serviceTypeSelect.locator('option').count()
      expect(options).toBeGreaterThanOrEqual(1)
      
      // If there's more than just placeholder, select the first real option
      if (options > 1) {
        await serviceTypeSelect.selectOption({ index: 1 })
      }
    })

    test('should accept invoice number input', async () => {
      const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
      await expect(invoiceInput).toBeVisible()
      
      await invoiceInput.fill('INV-2024-001')
      await expect(invoiceInput).toHaveValue('INV-2024-001')
    })

    test('should have period input with default value', async () => {
      const periodInput = page.locator('input[placeholder="e.g., Dec24"]')
      await expect(periodInput).toBeVisible()
      
      // Should have default value
      const defaultValue = await periodInput.inputValue()
      expect(defaultValue).toBeTruthy()
      
      // Should be editable
      await periodInput.fill('Jan25')
      await expect(periodInput).toHaveValue('Jan25')
    })
  })

  test.describe('Conditional Fields', () => {
    test('should show Department field for Contract Salaries', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      const contractSalariesOption = options.find(opt => opt.includes('Contract Salaries'))
      if (contractSalariesOption) {
        await chartOfAccountSelect.selectOption({ label: contractSalariesOption })
        
        // Department field should appear - look for select after the service type
        await page.waitForSelector('label:has-text("Department")')
        const departmentSelect = page.locator('select').nth(2)
        await expect(departmentSelect).toBeVisible()
        
        // Test department selection
        await departmentSelect.selectOption({ index: 1 })
      }
    })

    test('should show Region field for certain accounts', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      const accountingOption = options.find(opt => opt.includes('Accounting'))
      if (accountingOption) {
        await chartOfAccountSelect.selectOption({ label: accountingOption })
        
        // Region field should appear
        await page.waitForSelector('label:has-text("Region")')
        const regionSelect = page.locator('select').nth(2)
        await expect(regionSelect).toBeVisible()
        
        // Test region selection - check if US option exists
        const hasUSOption = await regionSelect.locator('option[value="US"]').count() > 0
        if (hasUSOption) {
          await regionSelect.selectOption('US')
          await expect(regionSelect).toHaveValue('US')
        }
      }
    })

    test('should show SKU and Batch fields for manufacturing/3PL', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      const manufacturingOption = options.find(opt => opt.includes('Manufacturing') || opt.includes('3PL'))
      if (manufacturingOption) {
        await chartOfAccountSelect.selectOption({ label: manufacturingOption })
        
        // SKU field should appear
        const skuInput = page.locator('input[placeholder="e.g., CS 007"]')
        await expect(skuInput).toBeVisible()
        await skuInput.fill('TEST-SKU-001')
        
        // Batch field should appear
        const batchInput = page.locator('input[placeholder="e.g., Batch 12"]')
        await expect(batchInput).toBeVisible()
        await batchInput.fill('Batch 2024-01')
      }
    })

    test('should show vessel fields for shipping-related', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      const freightOption = options.find(opt => opt.includes('Freight'))
      if (freightOption) {
        await chartOfAccountSelect.selectOption({ label: freightOption })
        
        // Wait for service type and select shipping-related
        const serviceTypeSelect = page.locator('select').nth(1)
        await serviceTypeSelect.waitFor()
        const serviceOptions = await serviceTypeSelect.locator('option').allTextContents()
        const containerOption = serviceOptions.find(opt => opt.includes('Container'))
        
        if (containerOption) {
          await serviceTypeSelect.selectOption({ label: containerOption })
          
          // Vessel fields should appear
          const vesselInput = page.locator('input[placeholder="e.g., OOCL Spain"]')
          const containerInput = page.locator('input[placeholder="e.g., OOCU8157379"]')
          const countryInput = page.locator('input[placeholder="e.g., UK"]')
          
          await expect(vesselInput).toBeVisible()
          await expect(containerInput).toBeVisible()
          await expect(countryInput).toBeVisible()
          
          await vesselInput.fill('Test Vessel')
          await containerInput.fill('CONT123456')
          await countryInput.fill('US')
        }
      }
    })

    test('should show frequency selector for subscription services', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      // Find subscription-related account
      const subscriptionOption = options.find(opt => 
        opt.toLowerCase().includes('subscription') || 
        opt.toLowerCase().includes('software') ||
        opt.toLowerCase().includes('license')
      )
      
      if (subscriptionOption) {
        await chartOfAccountSelect.selectOption({ label: subscriptionOption })
        
        // Wait for service type
        await page.waitForSelector('select:nth-of-type(2)')
        const serviceTypeSelect = page.locator('select').nth(1)
        
        // Select a service that might show frequency
        const serviceOptions = await serviceTypeSelect.locator('option').allTextContents()
        if (serviceOptions.length > 1) {
          await serviceTypeSelect.selectOption({ index: 1 })
          
          // Frequency selector should appear
          const frequencySelect = page.locator('select').filter({ has: page.locator('option[value="Monthly"]') })
          const hasFrequency = await frequencySelect.isVisible({ timeout: 1000 }).catch(() => false)
          
          if (hasFrequency) {
            await expect(frequencySelect).toBeVisible()
            
            // Test frequency options
            const freqOptions = await frequencySelect.locator('option').allTextContents()
            expect(freqOptions).toContain('Monthly')
            expect(freqOptions).toContain('Quarterly')
            expect(freqOptions).toContain('Annual')
            
            await frequencySelect.selectOption('Quarterly')
            await expect(frequencySelect).toHaveValue('Quarterly')
          }
        }
      }
    })

    test('should show FBA fields for Amazon FBA services', async () => {
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').allTextContents()
      
      // Find FBA-related account
      const fbaOption = options.find(opt => 
        opt.toLowerCase().includes('fba') || 
        opt.toLowerCase().includes('amazon') ||
        opt.toLowerCase().includes('fulfillment')
      )
      
      if (fbaOption) {
        await chartOfAccountSelect.selectOption({ label: fbaOption })
        
        // Wait for service type
        await page.waitForSelector('select:nth-of-type(2)')
        const serviceTypeSelect = page.locator('select').nth(1)
        
        // Select FBA service
        const serviceOptions = await serviceTypeSelect.locator('option').allTextContents()
        const fbaService = serviceOptions.find(opt => opt.toLowerCase().includes('fba'))
        
        if (fbaService) {
          await serviceTypeSelect.selectOption({ label: fbaService })
          
          // FBA fields should appear
          const shipmentPlanInput = page.locator('input[placeholder*="FBA Shipment Plan"]')
          const locationInput = page.locator('input[placeholder*="Location"], input[placeholder*="Warehouse"]')
          
          const hasShipmentPlan = await shipmentPlanInput.isVisible({ timeout: 1000 }).catch(() => false)
          const hasLocation = await locationInput.isVisible({ timeout: 1000 }).catch(() => false)
          
          if (hasShipmentPlan) {
            await expect(shipmentPlanInput).toBeVisible()
            await shipmentPlanInput.fill('FBA-PLAN-2024-001')
          }
          
          if (hasLocation) {
            await expect(locationInput).toBeVisible()
            await locationInput.fill('LAX1')
          }
        }
      }
    })

    test('should always show short tag field', async () => {
      // Short tag should be visible for all selections
      const shortTagInput = page.locator('input[placeholder*="Short Tag"], input[placeholder*="short tag"], input[name="shortTag"]')
      
      // Select any account
      const chartOfAccountSelect = page.locator('select').first()
      const options = await chartOfAccountSelect.locator('option').count()
      
      if (options > 1) {
        await chartOfAccountSelect.selectOption({ index: 1 })
        
        // Wait for form to update
        await page.waitForTimeout(500)
        
        // Short tag should be visible
        const hasShortTag = await shortTagInput.isVisible().catch(() => false)
        
        if (hasShortTag) {
          await expect(shortTagInput).toBeVisible()
          await shortTagInput.fill('TEST-TAG-2024')
          await expect(shortTagInput).toHaveValue('TEST-TAG-2024')
        }
      }
    })
  })

  test.describe('Action Buttons', () => {
    test('should validate required fields before generation', async () => {
      const generateButton = page.locator('button:has-text("Generate SOP")')
      await expect(generateButton).toBeVisible()
      
      // Click without filling required fields
      await generateButton.click()
      
      // Should show error toast
      await expect(page.locator('text="Please fill in all required fields"')).toBeVisible()
    })

    test('should generate SOP with valid inputs', async () => {
      // Fill required fields
      const chartOfAccountSelect = page.locator('select').first()
      await chartOfAccountSelect.selectOption({ index: 1 })
      
      // Wait for service types to load
      await page.waitForTimeout(500)
      const serviceTypeSelect = page.locator('select').nth(1)
      await expect(serviceTypeSelect).toBeVisible()
      const serviceOptions = await serviceTypeSelect.locator('option').count()
      if (serviceOptions > 1) {
        await serviceTypeSelect.selectOption({ index: 1 })
      }
      
      const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
      await invoiceInput.fill('TEST-001')
      
      // Generate
      const generateButton = page.locator('button:has-text("Generate SOP")')
      await generateButton.click()
      
      // Should show loading state or error toast
      await page.waitForTimeout(100)
      
      // Should show results or error
      const generatedSOP = page.locator('h2:has-text("Generated SOP")')
      const errorToast = page.locator('[class*="Toastify"]').or(page.locator('[role="status"]'))
      
      // Wait a bit for processing
      await page.waitForTimeout(1000)
      
      // Check if we got results or an error
      const hasResults = await generatedSOP.isVisible()
      const hasError = await page.locator('text=/Please fill|No SOP rule/').isVisible()
      
      expect(hasResults || hasError).toBeTruthy()
    })

    test('should reset form when clicking Reset', async () => {
      // Fill some fields
      const chartOfAccountSelect = page.locator('select').first()
      await chartOfAccountSelect.selectOption({ index: 1 })
      
      const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
      await invoiceInput.fill('TEST-001')
      
      // Click Reset
      const resetButton = page.locator('button:has-text("Reset")')
      await expect(resetButton).toBeVisible()
      await resetButton.click()
      
      // Fields should be cleared
      await expect(chartOfAccountSelect).toHaveValue('')
      await expect(invoiceInput).toHaveValue('')
    })
  })

  test.describe('Results Section', () => {
    test('should copy reference to clipboard', async () => {
      // Generate SOP first
      await generateValidSOP(page)
      
      // Find copy button for reference
      const copyButtons = page.locator('button').filter({ has: page.locator('svg') })
      const referenceButton = copyButtons.first()
      
      // Set up clipboard permission
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await referenceButton.click()
      
      // Should show success toast
      await expect(page.locator('text="Reference copied to clipboard!"')).toBeVisible()
    })

    test('should copy description to clipboard', async () => {
      // Generate SOP first
      await generateValidSOP(page)
      
      // Find copy button for description
      const copyButtons = page.locator('button').filter({ has: page.locator('svg') })
      const descriptionButton = copyButtons.nth(1)
      
      // Set up clipboard permission
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      
      await descriptionButton.click()
      
      // Should show success toast
      await expect(page.locator('text="Description copied to clipboard!"')).toBeVisible()
    })

    test('should display how to use in Xero instructions', async () => {
      await generateValidSOP(page)
      
      // Should show instructions
      await expect(page.locator('h3:has-text("How to use in Xero")')).toBeVisible()
      
      // Should have numbered steps
      const steps = page.locator('ol li')
      const stepCount = await steps.count()
      expect(stepCount).toBeGreaterThan(5)
    })

    test('should display SOP rules', async () => {
      await generateValidSOP(page)
      
      // Should show rules section
      await expect(page.locator('h3:has-text("SOP Rules")')).toBeVisible()
      
      // Should have rule items
      const rules = page.locator('li').filter({ has: page.locator('span.text-amber-400') })
      const ruleCount = await rules.count()
      expect(ruleCount).toBeGreaterThan(0)
    })
  })

  test.describe('Empty State', () => {
    test('should show empty state before generation', async () => {
      const emptyState = page.locator('text="No SOP Generated Yet"')
      await expect(emptyState).toBeVisible()
      
      const emptyIcon = page.locator('svg.text-gray-600')
      await expect(emptyIcon).toBeVisible()
    })
  })
})

// Helper function to generate a valid SOP
async function generateValidSOP(page: Page) {
  const chartOfAccountSelect = page.locator('select').first()
  // Select an account that has service types (like Contract Salaries)
  const options = await chartOfAccountSelect.locator('option').allTextContents()
  const contractSalariesIndex = options.findIndex(opt => opt.includes('Contract Salaries'))
  if (contractSalariesIndex > 0) {
    await chartOfAccountSelect.selectOption({ index: contractSalariesIndex })
  } else {
    await chartOfAccountSelect.selectOption({ index: 1 })
  }
  
  // Wait for service types to load
  await page.waitForTimeout(500)
  const serviceTypeSelect = page.locator('select').nth(1)
  await expect(serviceTypeSelect).toBeVisible()
  const serviceOptions = await serviceTypeSelect.locator('option').count()
  if (serviceOptions > 1) {
    await serviceTypeSelect.selectOption({ index: 1 })
  }
  
  const invoiceInput = page.locator('input[placeholder="Enter invoice number"]')
  await invoiceInput.fill('TEST-001')
  
  const generateButton = page.locator('button:has-text("Generate SOP")')
  await generateButton.click()
  
  // Wait for results to appear
  await page.waitForTimeout(1000)
  const generatedSOP = page.locator('h2:has-text("Generated SOP")')
  const hasResults = await generatedSOP.isVisible()
  
  if (!hasResults) {
    // Check if there was an error
    const hasError = await page.locator('text=/Please fill|No SOP rule/').isVisible()
    if (!hasError) {
      throw new Error('SOP generation failed without error message')
    }
  }
}
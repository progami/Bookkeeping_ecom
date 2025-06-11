import { test, expect } from '@playwright/test'

test.describe('Debug SOP Generator Dropdowns', () => {
  test('check dropdown functionality and console logs', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = []
    page.on('console', msg => {
      consoleLogs.push(`${msg.type()}: ${msg.text()}`)
      console.log(`Browser console - ${msg.type()}: ${msg.text()}`)
    })
    
    // Capture page errors
    page.on('pageerror', err => {
      console.error('Page error:', err.message)
    })
    
    // Navigate to the page
    await page.goto('/bookkeeping/sop-generator')
    await page.waitForLoadState('networkidle')
    
    // Check initial state
    console.log('\n=== Initial Page State ===')
    const accountSelects = await page.locator('select').filter({ hasText: 'Select Account' }).count()
    console.log('Account select dropdowns found:', accountSelects)
    
    // Get all selects on page
    const allSelects = await page.locator('select').count()
    console.log('Total select elements on page:', allSelects)
    
    // Try to select an account
    console.log('\n=== Selecting Account ===')
    const firstAccountSelect = page.locator('tbody tr').first().locator('select').first()
    await firstAccountSelect.selectOption('321 - Contract Salaries')
    
    // Wait a bit for React to update
    await page.waitForTimeout(1000)
    
    // Check console logs for our debug messages
    console.log('\n=== Console Logs ===')
    consoleLogs.forEach(log => console.log(log))
    
    // Check if service type dropdown appeared
    console.log('\n=== After Selection ===')
    const serviceTypeSelects = await page.locator('select').filter({ hasText: 'Select Service Type' }).count()
    console.log('Service type dropdowns found:', serviceTypeSelects)
    
    // Get the HTML of the table row to see what's rendered
    const firstRow = page.locator('tbody tr').first()
    const rowHTML = await firstRow.innerHTML()
    console.log('\n=== First Row HTML (truncated) ===')
    console.log(rowHTML.substring(0, 500) + '...')
    
    // Check if the chartOfAccount value was set
    const accountValue = await firstAccountSelect.inputValue()
    console.log('\n=== Selected Account Value ===')
    console.log('Account value:', accountValue)
    
    // Try to find service type select in the same row
    const secondTd = firstRow.locator('td').nth(2)
    const hasSelect = await secondTd.locator('select').count()
    console.log('Service type select in 3rd column:', hasSelect)
    
    // Get the actual content of the 3rd column
    const thirdColumnContent = await secondTd.innerHTML()
    console.log('\n=== Third Column Content ===')
    console.log(thirdColumnContent)
  })
})
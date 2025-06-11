import { test, expect } from '@playwright/test';

test.describe('SOP Generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3003/bookkeeping/sop-generator');
  });

  test('should display all required elements', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('SOP Generator');
    
    // Check year selection buttons
    await expect(page.getByRole('button', { name: '2024' })).toBeVisible();
    await expect(page.getByRole('button', { name: '2025' })).toBeVisible();
    
    // Check form fields
    await expect(page.locator('select[value=""]').first()).toBeVisible(); // Chart of Account
    await expect(page.locator('input[placeholder="Enter invoice number"]')).toBeVisible();
    
    // Check action buttons
    await expect(page.getByRole('button', { name: /Generate SOP/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  });

  test('should populate Chart of Account dropdown', async ({ page }) => {
    // Click on the Chart of Account dropdown
    const chartOfAccountSelect = page.locator('select').first();
    await chartOfAccountSelect.click();
    
    // Get all options
    const options = await chartOfAccountSelect.locator('option').allTextContents();
    
    // Should have at least one option besides "Select Account"
    expect(options.length).toBeGreaterThan(1);
    expect(options).toContain('Select Account');
    
    // Check for specific accounts in 2025 data
    expect(options.some(opt => opt.includes('321 - Contract Salaries'))).toBeTruthy();
    expect(options.some(opt => opt.includes('333 - Manufacturing'))).toBeTruthy();
    expect(options.some(opt => opt.includes('334 - Freight & Custom Duty'))).toBeTruthy();
  });

  test('should show Service Type dropdown after selecting Chart of Account', async ({ page }) => {
    // Select a Chart of Account
    const chartOfAccountSelect = page.locator('select').first();
    await chartOfAccountSelect.selectOption('321 - Contract Salaries');
    
    // Service Type dropdown should appear
    await expect(page.locator('text=Service Type')).toBeVisible();
    const serviceTypeSelect = page.locator('select').nth(1);
    await expect(serviceTypeSelect).toBeVisible();
    
    // Click to see options
    await serviceTypeSelect.click();
    const serviceOptions = await serviceTypeSelect.locator('option').allTextContents();
    
    // Should have service types for Contract Salaries
    expect(serviceOptions).toContain('Select Service Type');
    expect(serviceOptions).toContain('Salary');
    expect(serviceOptions).toContain('Compensation');
    expect(serviceOptions).toContain('Freelance');
  });

  test('should show conditional fields based on Chart of Account', async ({ page }) => {
    // Test 1: Contract Salaries should show Department field
    await page.locator('select').first().selectOption('321 - Contract Salaries');
    await expect(page.locator('text=Department')).toBeVisible();
    
    // Test 2: Manufacturing should show SKU field
    await page.locator('select').first().selectOption('333 - Manufacturing');
    await expect(page.locator('text=SKU')).toBeVisible();
    await expect(page.locator('text=Batch Number')).toBeVisible();
    
    // Test 3: Freight should show Vessel fields
    await page.locator('select').first().selectOption('334 - Freight & Custom Duty');
    await page.locator('select').nth(1).selectOption('Freight');
    await expect(page.locator('text=Vessel Name')).toBeVisible();
    await expect(page.locator('text=Container Number')).toBeVisible();
    await expect(page.locator('text=Country Code')).toBeVisible();
  });

  test('should generate SOP with valid inputs', async ({ page }) => {
    // Select Chart of Account
    await page.locator('select').first().selectOption('321 - Contract Salaries');
    
    // Select Service Type
    await page.locator('select').nth(1).selectOption('Salary');
    
    // Enter Invoice Number
    await page.locator('input[placeholder="Enter invoice number"]').fill('TDE24001');
    
    // Select Department
    await page.locator('select').nth(2).selectOption('Operations');
    
    // Enter Period
    await page.locator('input[placeholder="e.g., Dec24"]').fill('Dec24');
    
    // Enter Short Tag
    await page.locator('input[placeholder="Any additional description"]').fill('December Salary');
    
    // Click Generate SOP
    await page.getByRole('button', { name: /Generate SOP/i }).click();
    
    // Check if result appears
    await expect(page.locator('text=Generated SOP')).toBeVisible();
    
    // Check if Reference is generated
    await expect(page.locator('text=Reference').locator('..').locator('p')).toContainText('TDE24001');
    
    // Check if Description is generated
    await expect(page.locator('text=Description').locator('..').locator('p')).toContainText('Operations');
    
    // Check Copy buttons
    await expect(page.locator('button[aria-label*="Copy"]').first()).toBeVisible();
  });

  test('should show error when required fields are missing', async ({ page }) => {
    // Click Generate without filling required fields
    await page.getByRole('button', { name: /Generate SOP/i }).click();
    
    // Should show error toast
    await expect(page.locator('text=Please fill in all required fields')).toBeVisible();
  });

  test('should reset form when Reset button is clicked', async ({ page }) => {
    // Fill some fields
    await page.locator('select').first().selectOption('321 - Contract Salaries');
    await page.locator('input[placeholder="Enter invoice number"]').fill('TEST123');
    
    // Click Reset
    await page.getByRole('button', { name: 'Reset' }).click();
    
    // Check fields are cleared
    await expect(page.locator('select').first()).toHaveValue('');
    await expect(page.locator('input[placeholder="Enter invoice number"]')).toHaveValue('');
  });

  test('should switch between 2024 and 2025 years', async ({ page }) => {
    // Default should be 2025
    await expect(page.getByRole('button', { name: '2025' })).toHaveClass(/bg-emerald-600/);
    
    // Click 2024
    await page.getByRole('button', { name: '2024' }).click();
    await expect(page.getByRole('button', { name: '2024' })).toHaveClass(/bg-emerald-600/);
    await expect(page.getByRole('button', { name: '2025' })).not.toHaveClass(/bg-emerald-600/);
    
    // Chart of Account should update
    await page.locator('select').first().click();
    const options2024 = await page.locator('select').first().locator('option').allTextContents();
    
    // 2024 has different accounts
    expect(options2024.some(opt => opt.includes('429 - General Operating Expenses'))).toBeTruthy();
    expect(options2024.some(opt => opt.includes('463 - IT Software'))).toBeTruthy();
  });

  test('should navigate to SOP Tables page', async ({ page }) => {
    // Click View SOP Tables button
    await page.getByRole('button', { name: /View SOP Tables/i }).click();
    
    // Should navigate to SOP Tables page
    await expect(page).toHaveURL(/.*sop-tables/);
  });

  test('should display SOP rules after generating', async ({ page }) => {
    // Generate an SOP first
    await page.locator('select').first().selectOption('321 - Contract Salaries');
    await page.locator('select').nth(1).selectOption('Salary');
    await page.locator('input[placeholder="Enter invoice number"]').fill('TDE24001');
    await page.locator('select').nth(2).selectOption('Operations');
    await page.getByRole('button', { name: /Generate SOP/i }).click();
    
    // Check if SOP Rules section appears
    await expect(page.locator('text=SOP Rules')).toBeVisible();
    
    // Check if rules are displayed
    await expect(page.locator('text=Reference for invoice level detail')).toBeVisible();
    await expect(page.locator('text=Description for line-item level detail')).toBeVisible();
  });
});
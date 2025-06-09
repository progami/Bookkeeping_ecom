import { test, expect } from '@playwright/test';

test.describe('Basic Application Flow', () => {
  test('should navigate and show dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to bookkeeping
    await expect(page).toHaveURL('/bookkeeping');
    
    // Should show dashboard elements
    await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
    await expect(page.getByText('Intelligent financial categorization')).toBeVisible();
    
    // Should show stats
    await expect(page.getByTestId('total-rules')).toBeVisible();
    await expect(page.getByTestId('active-rules')).toBeVisible();
    await expect(page.getByTestId('inactive-rules')).toBeVisible();
    
    // Should show quick actions
    await expect(page.getByTestId('quick-actions')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New Rule' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View All Rules' })).toBeVisible();
    
    // Should show system status
    await expect(page.getByTestId('system-status')).toBeVisible();
    await expect(page.getByText('Not Connected')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect to Xero' })).toBeVisible();
  });
  
  test('should navigate to rules page', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Click view all rules
    await page.getByRole('button', { name: 'View All Rules' }).click();
    
    // Should be on rules page
    await expect(page).toHaveURL('/bookkeeping/rules');
    await expect(page.getByRole('heading', { name: 'Categorization Rules' })).toBeVisible();
  });
  
  test('should navigate to create rule page', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Click create new rule
    await page.getByRole('button', { name: 'Create New Rule' }).click();
    
    // Should be on new rule page
    await expect(page).toHaveURL('/bookkeeping/rules/new');
    await expect(page.getByRole('heading', { name: 'Create New Rule' })).toBeVisible();
    
    // Should have form fields
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Match Value')).toBeVisible();
    await expect(page.getByLabel('Account Code')).toBeVisible();
    await expect(page.getByLabel('Tax Type')).toBeVisible();
  });
  
  test('should create a new rule', async ({ page }) => {
    await page.goto('/bookkeeping/rules/new');
    
    // Fill in the form
    await page.getByLabel('Name').fill('Test Rule');
    await page.getByLabel('Description').fill('Test rule description');
    await page.getByLabel('Match Type').selectOption('contains');
    await page.getByLabel('Match Field').selectOption('description');
    await page.getByLabel('Match Value').fill('STRIPE');
    await page.getByLabel('Account Code').fill('200');
    await page.getByLabel('Tax Type').selectOption('INPUT2');
    
    // Save the rule
    await page.getByRole('button', { name: 'Create Rule' }).click();
    
    // Should redirect to rules page
    await expect(page).toHaveURL('/bookkeeping/rules');
    
    // Should show success message
    await expect(page.getByText('Rule created successfully')).toBeVisible();
    
    // Should show the new rule in the list
    await expect(page.getByText('Test Rule', { exact: true }).first()).toBeVisible();
  });
  
  test('should show disabled transaction button when not connected', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Transaction button should be disabled
    const transactionButton = page.getByRole('button', { name: 'Connect Xero First' });
    await expect(transactionButton).toBeVisible();
    await expect(transactionButton).toBeDisabled();
  });
});
import { test, expect } from '@playwright/test';

test.describe('Complete Application Flow', () => {
  test('should demonstrate complete user journey', async ({ page }) => {
    // 1. Navigate to dashboard
    await page.goto('/bookkeeping');
    await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
    
    // 2. Verify buttons are in the header
    const headerButtons = page.locator('.flex.gap-3').first();
    
    // Connect Xero button should be visible when not connected
    await expect(headerButtons.getByRole('button', { name: 'Connect Xero' })).toBeVisible();
    
    // Import SOPs button should be visible
    await expect(headerButtons.getByRole('button', { name: 'Import SOPs' })).toBeVisible();
    
    // Export Report button should be visible
    await expect(headerButtons.getByRole('button', { name: 'Export Report' })).toBeVisible();
    
    // 3. Create a rule
    await page.getByRole('button', { name: 'Create New Rule' }).click();
    await expect(page).toHaveURL('/bookkeeping/rules/new');
    
    // Fill in the form
    await page.getByLabel('Name').fill('Stripe Payments');
    await page.getByLabel('Description').fill('All Stripe payment transactions');
    await page.getByLabel('Match Value').fill('STRIPE');
    await page.getByLabel('Account Code').fill('200');
    await page.getByLabel('Tax Type').selectOption('INPUT2');
    
    // Save the rule
    await page.getByRole('button', { name: 'Create Rule' }).click();
    await expect(page).toHaveURL('/bookkeeping/rules');
    await expect(page.getByText('Rule created successfully')).toBeVisible();
    
    // 4. View the rule in the list
    await expect(page.getByText('Stripe Payments', { exact: true }).first()).toBeVisible();
    
    // 5. Go back to dashboard
    await page.goto('/bookkeeping');
    
    // Stats should update
    await expect(page.getByTestId('total-rules')).toContainText(/[1-9]/);
    await expect(page.getByTestId('active-rules')).toContainText(/[1-9]/);
    
    // System status should show Xero not connected
    await expect(page.getByTestId('system-status')).toContainText('Not Connected');
    
    // Transaction button should be disabled
    const transactionButton = page.getByRole('button', { name: 'Connect Xero First' });
    await expect(transactionButton).toBeDisabled();
  });
  
  test('should handle import flow', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Click Import SOPs
    await page.getByRole('button', { name: 'Import SOPs' }).click();
    
    // Wait for dialog to appear
    await page.waitForTimeout(500);
    
    // Dialog should be visible
    const dialog = page.locator('.fixed.inset-0');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Import Bookkeeping Rules')).toBeVisible();
    
    // Upload area should be visible
    await expect(dialog.getByText('Click to upload Excel file')).toBeVisible();
    
    // Close dialog
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });
});
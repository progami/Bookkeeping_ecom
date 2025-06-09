import { test, expect } from '@playwright/test';

test.describe('Dashboard Features', () => {
  test('should show Connect Xero button in header', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Should show Connect Xero button in the header near Export Report
    const connectButton = page.getByRole('button', { name: 'Connect Xero' }).first();
    await expect(connectButton).toBeVisible();
    
    // Should be near Export Report button
    const exportButton = page.getByRole('button', { name: 'Export Report' });
    await expect(exportButton).toBeVisible();
    
    // Both buttons should be in the same container
    const headerButtons = page.locator('.flex.gap-3').first();
    await expect(headerButtons).toContainText('Connect Xero');
    await expect(headerButtons).toContainText('Export Report');
  });
  
  test('should show Import SOPs button', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Should show Import SOPs button
    const importButton = page.getByRole('button', { name: 'Import SOPs' });
    await expect(importButton).toBeVisible();
    
    // Should be between Connect Xero and Export Report
    const headerButtons = page.locator('.flex.gap-3').first();
    await expect(headerButtons).toContainText('Import SOPs');
  });
  
  test('should open import dialog when clicking Import SOPs', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Click Import SOPs button
    await page.getByRole('button', { name: 'Import SOPs' }).click();
    
    // Should show import dialog
    await expect(page.locator('.fixed.inset-0')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import Bookkeeping Rules' })).toBeVisible();
    await expect(page.getByText('Upload Excel file with bookkeeping SOPs')).toBeVisible();
    
    // Should show file upload area
    await expect(page.getByText('Click to upload Excel file')).toBeVisible();
    await expect(page.getByText('Supports .xlsx, .xls, and .csv files')).toBeVisible();
    
    // Should have cancel and import buttons
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Rules' })).toBeVisible();
  });
  
  test('should close import dialog on cancel', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Open dialog
    await page.getByRole('button', { name: 'Import SOPs' }).click();
    await expect(page.locator('.fixed.inset-0')).toBeVisible();
    
    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click();
    
    // Dialog should close
    await expect(page.locator('.fixed.inset-0')).not.toBeVisible();
  });
  
  test('should handle file upload in import dialog', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Open dialog
    await page.getByRole('button', { name: 'Import SOPs' }).click();
    
    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-sops.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test excel content')
    });
    
    // Should show preview
    await expect(page.getByText('Preview')).toBeVisible();
    await expect(page.getByText(/Found.*rules in the file/)).toBeVisible();
    
    // Should show sample data in table
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'STRIPE' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'AMAZON' })).toBeVisible();
  });
  
  test('Connect Xero button should initiate OAuth flow', async ({ page }) => {
    await page.goto('/bookkeeping');
    
    // Click Connect Xero in header
    const connectButton = page.getByRole('button', { name: 'Connect Xero' }).first();
    await connectButton.click();
    
    // Should navigate to Xero auth endpoint
    await page.waitForURL(/\/api\/v1\/xero\/auth/);
  });
});
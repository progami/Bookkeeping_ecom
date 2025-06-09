import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Excel File Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookkeeping/rules');
  });

  test('should show import button on rules page', async ({ page }) => {
    await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
  });

  test('should open file upload dialog when clicking import', async ({ page }) => {
    // Click import button
    await page.getByRole('button', { name: /import/i }).click();
    
    // Should show upload dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/upload.*excel.*file/i)).toBeVisible();
    
    // Should show file input
    await expect(page.locator('input[type="file"]')).toBeVisible();
    
    // Should accept Excel files
    const fileInput = page.locator('input[type="file"]');
    const acceptAttribute = await fileInput.getAttribute('accept');
    expect(acceptAttribute).toContain('.xlsx');
    expect(acceptAttribute).toContain('.xls');
  });

  test('should preview Excel file before import', async ({ page }) => {
    // Open import dialog
    await page.getByRole('button', { name: /import/i }).click();
    
    // Create test Excel file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-rules.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test excel content')
    });
    
    // Should show preview
    await expect(page.getByText(/preview/i)).toBeVisible();
    await expect(page.getByText(/found.*rules/i)).toBeVisible();
    
    // Should show sample rules in preview table
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /pattern/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /reference/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /category/i })).toBeVisible();
  });

  test('should validate Excel file format', async ({ page }) => {
    await page.getByRole('button', { name: /import/i }).click();
    
    // Upload invalid file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('invalid content')
    });
    
    // Should show error
    await expect(page.getByText(/invalid.*file.*format/i)).toBeVisible();
    await expect(page.getByText(/please.*upload.*excel/i)).toBeVisible();
  });

  test('should import rules from Excel file', async ({ page }) => {
    await page.getByRole('button', { name: /import/i }).click();
    
    // Upload valid Excel file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'Bookkeeping SOPs.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test excel content')
    });
    
    // Wait for preview
    await page.waitForSelector('text=/preview/i');
    
    // Click import button in dialog
    await page.getByRole('button', { name: /import.*rules/i }).click();
    
    // Should show progress
    await expect(page.getByText(/importing/i)).toBeVisible();
    
    // Should show success message
    await expect(page.getByText(/successfully.*imported/i)).toBeVisible();
    
    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Rules should appear in table
    await expect(page.locator('table tbody tr')).toHaveCount(5); // Assuming 5 rules imported
  });

  test('should handle duplicate rules during import', async ({ page }) => {
    // First create a rule
    await page.goto('/bookkeeping/rules/new');
    await page.getByLabel('Name').fill('Existing Rule');
    await page.getByLabel('Match Value').fill('STRIPE');
    await page.getByLabel('Account Code').fill('200');
    await page.getByLabel('Tax Type').fill('GST');
    await page.getByRole('button', { name: /save/i }).click();
    
    // Go back to rules page
    await page.goto('/bookkeeping/rules');
    
    // Import Excel with duplicate
    await page.getByRole('button', { name: /import/i }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'rules-with-duplicates.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test excel content with STRIPE rule')
    });
    
    // Should show duplicate warning
    await expect(page.getByText(/duplicate.*rules.*detected/i)).toBeVisible();
    await expect(page.getByText(/STRIPE/)).toBeVisible();
    
    // Should offer options
    await expect(page.getByRole('radio', { name: /skip.*duplicates/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /update.*existing/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /create.*new/i })).toBeVisible();
  });

  test('should export rules to Excel', async ({ page }) => {
    // Create some test rules first
    for (let i = 1; i <= 3; i++) {
      await page.goto('/bookkeeping/rules/new');
      await page.getByLabel('Name').fill(`Test Rule ${i}`);
      await page.getByLabel('Match Value').fill(`PATTERN${i}`);
      await page.getByLabel('Account Code').fill(`20${i}`);
      await page.getByLabel('Tax Type').fill('GST');
      await page.getByRole('button', { name: /save/i }).click();
    }
    
    // Go to rules page
    await page.goto('/bookkeeping/rules');
    
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('bookkeeping-rules');
    expect(download.suggestedFilename()).toContain('.xlsx');
  });

  test('should show import history', async ({ page }) => {
    // Import a file first
    await page.getByRole('button', { name: /import/i }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-import.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('test excel content')
    });
    await page.getByRole('button', { name: /import.*rules/i }).click();
    
    // Wait for success
    await page.waitForSelector('text=/successfully.*imported/i');
    
    // Check import history
    await page.getByRole('button', { name: /import.*history/i }).click();
    
    // Should show import record
    await expect(page.getByText('test-import.xlsx')).toBeVisible();
    await expect(page.getByText(/imported.*rules/i)).toBeVisible();
    await expect(page.getByText(/today/i)).toBeVisible();
  });
});
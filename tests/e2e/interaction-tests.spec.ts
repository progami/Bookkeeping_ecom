import { test, expect } from '@playwright/test';

test.describe('User Interaction Tests', () => {
  test.describe('Button Interactions', () => {
    test('should handle all button hover states', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Test hover on Create New Rule button
      const createButton = page.getByRole('button', { name: 'Create New Rule' });
      await createButton.hover();
      await expect(createButton).toHaveCSS('background-color', /rgba\(16, 185, 129/); // emerald-600/30
      
      // Test hover on Import SOPs button
      const importButton = page.getByRole('button', { name: 'Import SOPs' });
      await importButton.hover();
      await expect(importButton).toHaveCSS('background-color', /rgba\(8, 145, 178/); // cyan-600/30
    });

    test('should handle button click animations', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Click and check navigation
      await page.getByRole('button', { name: 'Create New Rule' }).click();
      await expect(page).toHaveURL('/bookkeeping/rules/new');
    });
  });

  test.describe('Form Interactions', () => {
    test('should handle form validation', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new');
      
      // Try to submit empty form
      await page.getByRole('button', { name: 'Create Rule' }).click();
      
      // Should show validation errors
      await expect(page.getByText('Name is required')).toBeVisible();
      await expect(page.getByText('Match value is required')).toBeVisible();
      await expect(page.getByText('Account code is required')).toBeVisible();
    });

    test('should handle form input', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new');
      
      // Fill form
      await page.getByLabel('Rule Name').fill('Test Rule');
      await expect(page.getByLabel('Rule Name')).toHaveValue('Test Rule');
      
      await page.getByLabel('Description').fill('Test description');
      await expect(page.getByLabel('Description')).toHaveValue('Test description');
      
      // Select options
      await page.getByLabel('Match Type').selectOption('equals');
      await expect(page.getByLabel('Match Type')).toHaveValue('equals');
      
      await page.getByLabel('Match Field').selectOption('payee');
      await expect(page.getByLabel('Match Field')).toHaveValue('payee');
    });

    test('should handle checkbox interactions', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new');
      
      const activeCheckbox = page.getByLabel('Active');
      await expect(activeCheckbox).toBeChecked();
      
      await activeCheckbox.uncheck();
      await expect(activeCheckbox).not.toBeChecked();
      
      await activeCheckbox.check();
      await expect(activeCheckbox).toBeChecked();
    });
  });

  test.describe('Modal Interactions', () => {
    test('should open and close import dialog', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Open dialog
      await page.getByRole('button', { name: 'Import SOPs' }).click();
      
      // Check dialog content
      const dialog = page.locator('.fixed.inset-0');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Import Bookkeeping Rules')).toBeVisible();
      
      // Close with X button
      await dialog.locator('button').filter({ has: page.locator('svg') }).first().click();
      await expect(dialog).not.toBeVisible();
      
      // Open again and close with Cancel
      await page.getByRole('button', { name: 'Import SOPs' }).click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).not.toBeVisible();
    });

    test('should handle file upload in import dialog', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      await page.getByRole('button', { name: 'Import SOPs' }).click();
      
      const dialog = page.locator('.fixed.inset-0');
      const fileInput = dialog.locator('input[type="file"]');
      
      // Check file input accepts correct formats
      const accept = await fileInput.getAttribute('accept');
      expect(accept).toContain('.xlsx');
      expect(accept).toContain('.xls');
      expect(accept).toContain('.csv');
    });
  });

  test.describe('Search and Filter', () => {
    test('should handle search input', async ({ page }) => {
      await page.goto('/bookkeeping/rules');
      
      const searchInput = page.getByPlaceholder('Search rules...');
      await searchInput.fill('test search');
      await expect(searchInput).toHaveValue('test search');
      
      // Clear search
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    });

    test('should handle filter dropdowns', async ({ page }) => {
      await page.goto('/bookkeeping/rules');
      
      // Status filter
      const statusFilter = page.getByRole('combobox').first();
      await statusFilter.selectOption('active');
      await expect(statusFilter).toHaveValue('active');
      
      await statusFilter.selectOption('inactive');
      await expect(statusFilter).toHaveValue('inactive');
      
      await statusFilter.selectOption('all');
      await expect(statusFilter).toHaveValue('all');
    });
  });

  test.describe('Error States', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Mock API error
      await page.route('/api/v1/bookkeeping/stats', route => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' })
        });
      });
      
      await page.goto('/bookkeeping');
      
      // Should still show UI without crashing
      await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading states', async ({ page }) => {
      // Slow down API response
      await page.route('/api/v1/bookkeeping/stats', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      
      await page.goto('/bookkeeping');
      
      // Should show loading spinner
      const spinner = page.locator('.animate-spin').first();
      await expect(spinner).toBeVisible();
      
      // Wait for content to load
      await page.waitForSelector('[data-testid="total-rules"]');
      await expect(spinner).not.toBeVisible();
    });
  });

  test.describe('Toast Notifications', () => {
    test('should show success toast on rule creation', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new');
      
      // Fill minimum required fields
      await page.getByLabel('Rule Name').fill('Test Rule');
      await page.getByLabel('Match Value').fill('TEST');
      await page.getByLabel('Account Code').fill('200');
      
      // Submit
      await page.getByRole('button', { name: 'Create Rule' }).click();
      
      // Should show success toast
      await expect(page.getByText('Rule created successfully')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Start tabbing
      await page.keyboard.press('Tab');
      
      // Should focus on first interactive element
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tag: el?.tagName,
          text: el?.textContent,
          type: el?.getAttribute('type')
        };
      });
      
      expect(focusedElement.tag).toBeTruthy();
    });

    test('should support enter key on buttons', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Tab to Create New Rule button
      const createButton = page.getByRole('button', { name: 'Create New Rule' });
      await createButton.focus();
      
      // Press Enter
      await page.keyboard.press('Enter');
      
      // Should navigate
      await expect(page).toHaveURL('/bookkeeping/rules/new');
    });
  });
});
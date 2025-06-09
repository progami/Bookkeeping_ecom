import { test, expect } from '@playwright/test';

test.describe('Transaction Reconciliation', () => {
  test.beforeEach(async ({ page }) => {
    // Connect to Xero and navigate to transactions
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    await page.waitForURL('/bookkeeping');
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
  });

  test('should open reconciliation modal for individual transaction', async ({ page }) => {
    // Click reconcile button on a matched transaction
    const matchedRow = page.locator('tr:has-text("STRIPE")').first();
    await matchedRow.getByRole('button', { name: /reconcile/i }).click();
    
    // Should open reconciliation modal
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /reconcile.*transaction/i })).toBeVisible();
    
    // Should show transaction details
    await expect(page.getByText(/original.*description/i)).toBeVisible();
    await expect(page.getByText('STRIPE')).toBeVisible();
    
    // Should show matched rule info
    await expect(page.getByText(/matched.*rule/i)).toBeVisible();
    await expect(page.getByText(/suggested.*reference/i)).toBeVisible();
    await expect(page.getByText(/suggested.*description/i)).toBeVisible();
  });

  test('should show editable fields in reconciliation modal', async ({ page }) => {
    const matchedRow = page.locator('tr:has-text("STRIPE")').first();
    await matchedRow.getByRole('button', { name: /reconcile/i }).click();
    
    // Should have editable fields
    const referenceInput = page.getByLabel(/reference/i);
    const descriptionInput = page.getByLabel(/description/i);
    const accountSelect = page.getByLabel(/account.*code/i);
    const taxSelect = page.getByLabel(/tax.*type/i);
    
    await expect(referenceInput).toBeEditable();
    await expect(descriptionInput).toBeEditable();
    await expect(accountSelect).toBeVisible();
    await expect(taxSelect).toBeVisible();
    
    // Fields should be pre-filled with suggested values
    await expect(referenceInput).toHaveValue(/PAYMENT/);
    await expect(descriptionInput).toHaveValue(/Stripe.*Payment/);
  });

  test('should reconcile individual transaction', async ({ page }) => {
    const matchedRow = page.locator('tr:has-text("STRIPE")').first();
    await matchedRow.getByRole('button', { name: /reconcile/i }).click();
    
    // Edit fields if needed
    await page.getByLabel(/description/i).fill('Stripe Payment - Updated');
    
    // Click reconcile button
    await page.getByRole('button', { name: /confirm.*reconcile/i }).click();
    
    // Should show success message
    await expect(page.getByText(/transaction.*reconciled.*successfully/i)).toBeVisible();
    
    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
    
    // Transaction should be marked as reconciled
    await expect(matchedRow).not.toBeVisible(); // Removed from unreconciled list
  });

  test('should bulk reconcile matched transactions', async ({ page }) => {
    // Select multiple matched transactions
    const checkboxes = page.locator('tr:has-text("matched") input[type="checkbox"]');
    const count = await checkboxes.count();
    
    for (let i = 0; i < Math.min(3, count); i++) {
      await checkboxes.nth(i).click();
    }
    
    // Click bulk reconcile
    await page.getByRole('button', { name: /bulk.*reconcile/i }).click();
    
    // Should show confirmation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/reconcile.*3.*transactions/i)).toBeVisible();
    
    // Should show summary of transactions
    await expect(page.getByText(/transactions.*will.*be.*reconciled/i)).toBeVisible();
    
    // Confirm bulk reconciliation
    await page.getByRole('button', { name: /confirm.*reconcile/i }).click();
    
    // Should show progress
    await expect(page.getByText(/reconciling.*transactions/i)).toBeVisible();
    
    // Should show success
    await expect(page.getByText(/3.*transactions.*reconciled/i)).toBeVisible();
    
    // Transactions should be removed from list
    const remainingRows = page.locator('table tbody tr');
    const newCount = await remainingRows.count();
    expect(newCount).toBeLessThan(10); // Assuming started with 10
  });

  test('should handle manual reconciliation for unmatched transactions', async ({ page }) => {
    // Find unmatched transaction
    const unmatchedRow = page.locator('tr:has-text("no match")').first();
    await unmatchedRow.getByRole('button', { name: /reconcile/i }).click();
    
    // Should open manual reconciliation modal
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/manual.*reconciliation/i)).toBeVisible();
    
    // All fields should be empty/default
    const referenceInput = page.getByLabel(/reference/i);
    const descriptionInput = page.getByLabel(/description/i);
    
    await expect(referenceInput).toHaveValue('');
    await expect(descriptionInput).toHaveValue('');
    
    // Should suggest possible matches
    await expect(page.getByText(/suggested.*matches/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /use.*suggestion/i })).toBeVisible();
  });

  test('should create new rule during reconciliation', async ({ page }) => {
    const unmatchedRow = page.locator('tr:has-text("UNKNOWN VENDOR")').first();
    await unmatchedRow.getByRole('button', { name: /reconcile/i }).click();
    
    // Fill in reconciliation details
    await page.getByLabel(/reference/i).fill('NEW-REF');
    await page.getByLabel(/description/i).fill('New Vendor Payment');
    await page.getByLabel(/account.*code/i).selectOption('400');
    await page.getByLabel(/tax.*type/i).selectOption('GST');
    
    // Check "Create rule" checkbox
    await page.getByLabel(/create.*rule.*for.*future/i).click();
    
    // Should show rule creation fields
    await expect(page.getByLabel(/rule.*name/i)).toBeVisible();
    await expect(page.getByLabel(/match.*pattern/i)).toBeVisible();
    
    // Fill rule details
    await page.getByLabel(/rule.*name/i).fill('Unknown Vendor Rule');
    await page.getByLabel(/match.*pattern/i).fill('UNKNOWN VENDOR');
    
    // Reconcile with new rule
    await page.getByRole('button', { name: /reconcile.*create.*rule/i }).click();
    
    // Should show success for both
    await expect(page.getByText(/transaction.*reconciled/i)).toBeVisible();
    await expect(page.getByText(/rule.*created/i)).toBeVisible();
  });

  test('should validate reconciliation fields', async ({ page }) => {
    const row = page.locator('table tbody tr').first();
    await row.getByRole('button', { name: /reconcile/i }).click();
    
    // Clear required fields
    await page.getByLabel(/reference/i).clear();
    await page.getByLabel(/description/i).clear();
    
    // Try to reconcile
    await page.getByRole('button', { name: /confirm.*reconcile/i }).click();
    
    // Should show validation errors
    await expect(page.getByText(/reference.*required/i)).toBeVisible();
    await expect(page.getByText(/description.*required/i)).toBeVisible();
    
    // Should not close modal
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should handle reconciliation errors', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/xero/transactions/*', route => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 400,
          json: { error: 'Transaction already reconciled' }
        });
      } else {
        route.continue();
      }
    });
    
    const row = page.locator('table tbody tr').first();
    await row.getByRole('button', { name: /reconcile/i }).click();
    await page.getByRole('button', { name: /confirm.*reconcile/i }).click();
    
    // Should show error
    await expect(page.getByText(/already.*reconciled/i)).toBeVisible();
    
    // Modal should stay open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('should preview changes before reconciliation', async ({ page }) => {
    const row = page.locator('tr:has-text("STRIPE")').first();
    await row.getByRole('button', { name: /reconcile/i }).click();
    
    // Make changes
    await page.getByLabel(/reference/i).fill('UPDATED-REF');
    await page.getByLabel(/description/i).fill('Updated Description');
    
    // Click preview
    await page.getByRole('button', { name: /preview.*changes/i }).click();
    
    // Should show before/after comparison
    await expect(page.getByText(/before/i)).toBeVisible();
    await expect(page.getByText(/after/i)).toBeVisible();
    
    // Should show original values
    await expect(page.getByText('STRIPE')).toBeVisible();
    
    // Should show new values
    await expect(page.getByText('UPDATED-REF')).toBeVisible();
    await expect(page.getByText('Updated Description')).toBeVisible();
  });

  test('should undo last reconciliation', async ({ page }) => {
    // First reconcile a transaction
    const row = page.locator('table tbody tr').first();
    const originalText = await row.textContent();
    await row.getByRole('button', { name: /reconcile/i }).click();
    await page.getByRole('button', { name: /confirm.*reconcile/i }).click();
    
    // Wait for success
    await page.waitForSelector('text=/transaction.*reconciled.*successfully/i');
    
    // Should show undo button
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
    
    // Click undo
    await page.getByRole('button', { name: /undo/i }).click();
    
    // Transaction should reappear in list
    await expect(page.locator(`text="${originalText}"`)).toBeVisible();
    
    // Should show undo success message
    await expect(page.getByText(/reconciliation.*undone/i)).toBeVisible();
  });

  test('should show reconciliation history', async ({ page }) => {
    // Navigate to reconciliation history
    await page.getByRole('button', { name: /view.*history/i }).click();
    
    // Should show history page/modal
    await expect(page.getByText(/reconciliation.*history/i)).toBeVisible();
    
    // Should show reconciled transactions
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /date.*reconciled/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /transaction/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /reconciled.*by/i })).toBeVisible();
    
    // Should allow filtering history
    await expect(page.getByPlaceholder(/search.*history/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /date.*range/i })).toBeVisible();
  });
});
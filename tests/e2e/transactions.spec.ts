import { test, expect } from '@playwright/test';

test.describe('Transaction Management', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is connected to Xero
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    await page.waitForURL('/bookkeeping');
  });

  test('should navigate to transactions page', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    
    await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sync.*transactions/i })).toBeVisible();
  });

  test('should fetch and display unreconciled transactions', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    
    // Click sync button
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/fetching.*transactions/i)).toBeVisible();
    
    // Should display transactions table
    await expect(page.locator('table')).toBeVisible();
    
    // Should have proper columns
    await expect(page.getByRole('columnheader', { name: /date/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /match/i })).toBeVisible();
    
    // Should show transaction rows
    await expect(page.locator('table tbody tr')).toHaveCount(10); // Assuming 10 transactions
  });

  test('should show matched and unmatched transactions differently', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Matched transactions should have green indicator
    const matchedRow = page.locator('tr:has-text("STRIPE")').first();
    await expect(matchedRow).toHaveClass(/matched/);
    await expect(matchedRow.locator('.match-indicator')).toHaveClass(/text-green/);
    await expect(matchedRow.getByText(/matched/i)).toBeVisible();
    
    // Unmatched transactions should have red indicator
    const unmatchedRow = page.locator('tr:has-text("UNKNOWN VENDOR")').first();
    await expect(unmatchedRow).toHaveClass(/unmatched/);
    await expect(unmatchedRow.locator('.match-indicator')).toHaveClass(/text-red/);
    await expect(unmatchedRow.getByText(/no match/i)).toBeVisible();
  });

  test('should filter transactions by status', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Filter by matched
    await page.getByRole('combobox', { name: /filter.*status/i }).click();
    await page.getByRole('option', { name: /matched/i }).click();
    
    // Should only show matched transactions
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(5); // Assuming 5 matched
    
    for (const row of await rows.all()) {
      await expect(row.getByText(/matched/i)).toBeVisible();
    }
    
    // Filter by unmatched
    await page.getByRole('combobox', { name: /filter.*status/i }).click();
    await page.getByRole('option', { name: /unmatched/i }).click();
    
    // Should only show unmatched transactions
    const unmatchedRows = page.locator('table tbody tr');
    for (const row of await unmatchedRows.all()) {
      await expect(row.getByText(/no match/i)).toBeVisible();
    }
  });

  test('should search transactions', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Search for specific transaction
    await page.getByPlaceholder(/search.*transactions/i).fill('STRIPE');
    
    // Should filter results
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(3); // Assuming 3 Stripe transactions
    
    for (const row of await rows.all()) {
      await expect(row).toContainText('STRIPE');
    }
  });

  test('should show transaction details on click', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Click on a transaction
    await page.locator('table tbody tr').first().click();
    
    // Should show details panel/modal
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/transaction.*details/i)).toBeVisible();
    
    // Should show full transaction info
    await expect(page.getByText(/transaction.*id/i)).toBeVisible();
    await expect(page.getByText(/date/i)).toBeVisible();
    await expect(page.getByText(/amount/i)).toBeVisible();
    await expect(page.getByText(/reference/i)).toBeVisible();
    await expect(page.getByText(/bank.*account/i)).toBeVisible();
  });

  test('should paginate transactions', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Should show pagination controls
    await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
    await expect(page.getByText(/page.*1.*of/i)).toBeVisible();
    
    // Go to next page
    await page.getByRole('button', { name: /next/i }).click();
    
    // Should update page indicator
    await expect(page.getByText(/page.*2.*of/i)).toBeVisible();
    
    // Should show different transactions
    await expect(page.locator('table tbody tr')).toHaveCount(10);
  });

  test('should bulk select transactions', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Select all checkbox
    await page.locator('thead input[type="checkbox"]').click();
    
    // All row checkboxes should be checked
    const checkboxes = page.locator('tbody input[type="checkbox"]');
    for (const checkbox of await checkboxes.all()) {
      await expect(checkbox).toBeChecked();
    }
    
    // Should show bulk action buttons
    await expect(page.getByRole('button', { name: /bulk.*reconcile/i })).toBeVisible();
    await expect(page.getByText(/selected/i)).toContainText('10'); // 10 selected
  });

  test('should refresh transactions data', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Note initial transaction count
    const initialCount = await page.locator('table tbody tr').count();
    
    // Click refresh
    await page.getByRole('button', { name: /refresh/i }).click();
    
    // Should show loading state
    await expect(page.getByText(/refreshing/i)).toBeVisible();
    
    // Should update last sync time
    await expect(page.getByText(/last.*sync.*just now/i)).toBeVisible();
  });

  test('should export transactions to CSV', async ({ page }) => {
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Click export button
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export/i }).click();
    
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toContain('transactions');
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('should handle transaction sync errors', async ({ page }) => {
    // Mock API error
    await page.route('/api/v1/xero/transactions', route => {
      route.fulfill({
        status: 500,
        json: { error: 'Failed to fetch transactions' }
      });
    });
    
    await page.goto('/bookkeeping/transactions');
    await page.getByRole('button', { name: /sync.*transactions/i }).click();
    
    // Should show error message
    await expect(page.getByText(/failed.*fetch.*transactions/i)).toBeVisible();
    
    // Should show retry button
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });
});
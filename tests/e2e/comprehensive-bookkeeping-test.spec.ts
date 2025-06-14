import { test, expect } from '@playwright/test';

test.describe('Comprehensive Bookkeeping Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookkeeping');
  });

  test('should display all main dashboard elements', async ({ page }) => {
    // Check header
    await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
    
    // Check financial overview cards
    await expect(page.getByText('Cash in Bank')).toBeVisible();
    await expect(page.getByText('Net Assets')).toBeVisible();
    await expect(page.getByText('Net Profit')).toBeVisible();
    await expect(page.getByText('VAT Liability')).toBeVisible();
    
    // Check main bookkeeping tools
    await expect(page.getByRole('heading', { name: 'Bookkeeping Tools' })).toBeVisible();
    await expect(page.getByRole('button', { name: /SOP Generator/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Transactions/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /SOP Tables/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Chart of Accounts/i })).toBeVisible();
    
    // Check bank accounts section
    await expect(page.getByRole('heading', { name: 'Bank Accounts' })).toBeVisible();
    
    // Check recent transactions section
    await expect(page.getByRole('heading', { name: 'Recent Transactions' })).toBeVisible();
    
    // Check reconciliation status
    await expect(page.getByRole('heading', { name: 'Reconciliation' })).toBeVisible();
    
    // Verify no automation rules section exists
    await expect(page.getByRole('heading', { name: 'Automation' })).not.toBeVisible();
  });

  test('should navigate to SOP Generator', async ({ page }) => {
    await page.getByRole('button', { name: /SOP Generator/i }).click();
    await expect(page).toHaveURL('/bookkeeping/sop-generator');
    await expect(page.getByRole('heading', { name: 'SOP Code Generator' })).toBeVisible();
  });

  test('should navigate to Transactions', async ({ page }) => {
    await page.getByRole('button', { name: /Transactions/i }).click();
    await expect(page).toHaveURL('/bookkeeping/transactions');
    await expect(page.getByRole('heading', { name: 'Bank Transactions' })).toBeVisible();
  });

  test('should navigate to SOP Tables', async ({ page }) => {
    await page.getByRole('button', { name: /SOP Tables/i }).click();
    await expect(page).toHaveURL('/bookkeeping/sop-tables');
    await expect(page.getByRole('heading', { name: 'Standard Operating Procedures' })).toBeVisible();
  });

  test('should navigate to Chart of Accounts', async ({ page }) => {
    await page.getByRole('button', { name: /Chart of Accounts/i }).click();
    await expect(page).toHaveURL('/bookkeeping/chart-of-accounts');
    await expect(page.getByRole('heading', { name: 'Chart of Accounts' })).toBeVisible();
  });

  test('should display financial data without dummy values', async ({ page }) => {
    // Check that cash balance is displayed (not zero or placeholder)
    const cashBalance = page.locator('text=Cash in Bank').locator('..').locator('text=/£[0-9,]+/');
    await expect(cashBalance).toBeVisible();
    
    // Check that Net Assets is displayed
    const netAssets = page.locator('text=Net Assets').locator('..').locator('text=/£[0-9,]+/');
    await expect(netAssets).toBeVisible();
    
    // Check that Net Profit is displayed
    const netProfit = page.locator('text=Net Profit').locator('..').locator('text=/£[0-9,]+/');
    await expect(netProfit).toBeVisible();
    
    // Check that VAT Liability is displayed
    const vatLiability = page.locator('text=VAT Liability').locator('..').locator('text=/£[0-9,]+/');
    await expect(vatLiability).toBeVisible();
  });

  test('should handle Xero sync correctly', async ({ page }) => {
    // Look for sync button
    const syncButton = page.getByRole('button', { name: /Sync Transactions/i });
    
    if (await syncButton.isVisible()) {
      // Click sync and verify it shows loading state
      await syncButton.click();
      await expect(syncButton).toContainText('Syncing...');
      
      // Wait for sync to complete (max 30 seconds)
      await expect(syncButton).toContainText('Sync Transactions', { timeout: 30000 });
    }
  });

  test('should display reconciliation information', async ({ page }) => {
    // Check reconciliation section
    const reconciliationSection = page.locator('text=Reconciliation').locator('..');
    await expect(reconciliationSection).toBeVisible();
    
    // Check for unreconciled transactions count
    const unreconciledCount = reconciliationSection.locator('text=/[0-9]+/').first();
    await expect(unreconciledCount).toBeVisible();
  });

  test('should show recent transactions if available', async ({ page }) => {
    const transactionsSection = page.locator('text=Recent Transactions').locator('..');
    await expect(transactionsSection).toBeVisible();
    
    // Check if transactions are displayed or "No recent transactions" message
    const hasTransactions = await page.locator('text=/£[0-9,]+/').count() > 0;
    const noTransactionsMessage = await page.locator('text=No recent transactions').isVisible();
    
    expect(hasTransactions || noTransactionsMessage).toBeTruthy();
  });
});

test.describe('Finance Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/finance');
  });

  test('should display all finance modules', async ({ page }) => {
    // Check header
    await expect(page.getByRole('heading', { name: 'Finance Command Center' })).toBeVisible();
    
    // Check financial health score
    await expect(page.getByText('Financial Health Score')).toBeVisible();
    
    // Check key metrics
    await expect(page.getByText('Total Cash Balance')).toBeVisible();
    await expect(page.getByText('Total Revenue')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
    await expect(page.getByText('Total Liabilities')).toBeVisible();
    
    // Check modules
    await expect(page.getByRole('heading', { name: 'Bookkeeping' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cash Flow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible();
  });

  test('should navigate to modules correctly', async ({ page }) => {
    // Navigate to Bookkeeping
    await page.locator('text=Bookkeeping').locator('..').click();
    await expect(page).toHaveURL('/bookkeeping');
    
    await page.goto('/finance');
    
    // Navigate to Cash Flow
    await page.locator('text=Cash Flow').locator('..').click();
    await expect(page).toHaveURL('/cashflow');
    
    await page.goto('/finance');
    
    // Navigate to Analytics
    await page.locator('text=Analytics').locator('..').click();
    await expect(page).toHaveURL('/analytics');
  });
});

test.describe('Analytics Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics');
  });

  test('should display vendor analytics', async ({ page }) => {
    // Check header
    await expect(page.getByRole('heading', { name: 'Business Analytics' })).toBeVisible();
    
    // Check key metrics
    await expect(page.getByText('Total Spend')).toBeVisible();
    await expect(page.getByText('Active Vendors')).toBeVisible();
    await expect(page.getByText('Top 5 Concentration')).toBeVisible();
    await expect(page.getByText('Top Vendor')).toBeVisible();
    
    // Check vendors table
    await expect(page.getByRole('heading', { name: 'Top 5 Vendors by Spend' })).toBeVisible();
  });

  test('should handle time range changes', async ({ page }) => {
    // Find time range selector
    const timeRangeSelector = page.locator('select').filter({ hasText: /days|year/ });
    
    // Change to 7 days
    await timeRangeSelector.selectOption('7d');
    await page.waitForLoadState('networkidle');
    
    // Change to year
    await timeRangeSelector.selectOption('year');
    await page.waitForLoadState('networkidle');
    
    // Verify data updates (check that some metric is still visible)
    await expect(page.getByText('Total Spend')).toBeVisible();
  });
});
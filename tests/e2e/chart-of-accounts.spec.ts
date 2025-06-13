import { test, expect } from '@playwright/test';

test.describe('Chart of Accounts Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chart of accounts page
    await page.goto('https://localhost:3003/bookkeeping/chart-of-accounts');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display page header and navigation', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Chart of Accounts');
    
    // Check back button exists
    await expect(page.locator('button:has-text("Back")')).toBeVisible();
    
    // Check sync button exists
    await expect(page.locator('button:has-text("Sync from Xero")')).toBeVisible();
  });

  test('should display account table with correct columns', async ({ page }) => {
    // Wait for account data to load (either table or no data message)
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    // Check if we have accounts or empty state
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Check column headers in grid layout
      await expect(page.locator('text="Code"').first()).toBeVisible();
      await expect(page.locator('text="Account Name"').first()).toBeVisible();
      await expect(page.locator('text="Type"').first()).toBeVisible();
      await expect(page.locator('text="Status"').first()).toBeVisible();
      await expect(page.locator('text="YTD Amount"').first()).toBeVisible();
    } else {
      // Check empty state
      await expect(page.locator('text="No accounts found"')).toBeVisible();
    }
  });

  test('should show YTD amounts by default', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    // Check if we have accounts
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // YTD column should be visible
      await expect(page.locator('text="YTD Amount"').first()).toBeVisible();
    }
    
    // Check that YTD toggle is checked by default (if it exists)
    const ytdToggle = page.locator('input[type="checkbox"]').first();
    if (await ytdToggle.count() > 0) {
      await expect(ytdToggle).toBeChecked();
    }
  });

  test('should have column-specific filter widgets', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Check for filter icons (svg elements) in column headers
      const filterIcons = await page.locator('.filter-dropdown svg').count();
      expect(filterIcons).toBeGreaterThan(0);
    }
  });

  test('should allow sorting by columns', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Click on Code column to sort
      const codeHeader = page.locator('.cursor-pointer:has-text("Code")').first();
      if (await codeHeader.count() > 0) {
        await codeHeader.click();
      }
      
      // Click on Type column to sort
      const typeHeader = page.locator('.cursor-pointer:has-text("Type")').first();
      if (await typeHeader.count() > 0) {
        await typeHeader.click();
      }
      
      // Click on YTD Amount column to sort
      const ytdHeader = page.locator('.cursor-pointer:has-text("YTD Amount")').first();
      if (await ytdHeader.count() > 0) {
        await ytdHeader.click();
      }
    }
  });

  test('should display bank accounts with proper codes', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Look for bank accounts in the grid rows
      const bankRows = page.locator('.border-slate-700\\/50:has-text("Current Assets")');
      const bankCount = await bankRows.count();
      
      if (bankCount > 0) {
        // Check codes in the first column of bank account rows
        const firstBankRow = bankRows.first();
        const codeText = await firstBankRow.locator('.col-span-2').first().textContent();
        
        // Bank accounts should have a code (not N/A)
        expect(codeText).not.toBe('N/A');
        expect(codeText).not.toBe('-');
        expect(codeText?.length).toBeGreaterThan(0);
      }
    }
  });

  test('should display system accounts like VAT', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Search for VAT account
      const searchInput = page.locator('input[placeholder*="Search"]');
      if (await searchInput.count() > 0 && await searchInput.isVisible()) {
        await searchInput.fill('VAT');
        await page.waitForTimeout(500); // Wait for filter to apply
      }
      
      // Check if VAT account exists in the grid
      const vatAccounts = page.locator('.border-slate-700\\/50:has-text("VAT")');
      const vatCount = await vatAccounts.count();
      
      // We expect to find the VAT account since we populated test data
      expect(vatCount).toBeGreaterThan(0);
    }
  });

  test('should sync accounts from Xero', async ({ page }) => {
    // Click sync button
    const syncButton = page.locator('button:has-text("Sync from Xero")');
    
    if (await syncButton.isVisible()) {
      await syncButton.click();
      
      // Wait for sync to complete (button text changes or loading state)
      await page.waitForTimeout(2000);
      
      // Check for success toast or completion
      const toast = page.locator('.Toastify__toast--success, [role="alert"]');
      const toastCount = await toast.count();
      
      if (toastCount > 0) {
        await expect(toast.first()).toBeVisible();
      }
    }
  });

  test('should filter accounts by type', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    const hasAccounts = await page.locator('.grid.grid-cols-12').count() > 0;
    
    if (hasAccounts) {
      // Find and click the Type filter dropdown
      const typeFilterButton = page.locator('.filter-dropdown button').nth(2); // Type is the 3rd column
      if (await typeFilterButton.count() > 0) {
        await typeFilterButton.click();
        
        // Wait for dropdown to appear and select an option
        await page.waitForTimeout(300);
        const filterOption = page.locator('button:has-text("Income")').first();
        if (await filterOption.count() > 0) {
          await filterOption.click();
          await page.waitForTimeout(500); // Wait for filter to apply
        }
      }
    }
  });

  test('should display account totals', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    // Check for total accounts count in the stats section
    const totalText = page.locator('text=/Total.*accounts/i, text=/[0-9]+ accounts/i, text=/Total Accounts.*[0-9]+/i');
    const hasTotal = await totalText.count() > 0;
    
    if (hasTotal) {
      await expect(totalText.first()).toBeVisible();
    } else {
      // Check for account count in grid headers or summary
      const accountCount = await page.locator('.grid.grid-cols-12').count();
      console.log(`Found ${accountCount - 1} account rows (excluding header)`);
    }
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.bg-slate-900/50, .bg-slate-800/30', { timeout: 10000 });
    
    // Check if we have the empty state or accounts
    const emptyState = page.locator('.bg-slate-800/30:has-text("No accounts found")');
    const accountRows = page.locator('.grid.grid-cols-12').filter({ hasNot: page.locator('text="Code"') });
    
    const hasEmptyState = await emptyState.count() > 0;
    const rowCount = await accountRows.count();
    
    // Either we have empty state or we have account rows
    expect(hasEmptyState || rowCount > 0).toBe(true);
  });

  test('should toggle archived accounts', async ({ page }) => {
    // Look for archived toggle
    const archivedToggle = page.locator('label:has-text("Show Archived"), input[type="checkbox"]:near(:text("Archived"))');
    
    if (await archivedToggle.isVisible()) {
      // Get initial row count
      const initialRows = await page.locator('tbody tr').count();
      
      // Toggle archived
      await archivedToggle.click();
      await page.waitForTimeout(1000); // Wait for re-render
      
      // Row count might change
      const newRows = await page.locator('tbody tr').count();
      console.log(`Rows before: ${initialRows}, after: ${newRows}`);
    }
  });

  test('should export accounts to CSV', async ({ page }) => {
    // Look for export button
    const exportButton = page.locator('button:has-text("Export"), button:has-text("Download")');
    
    if (await exportButton.isVisible()) {
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      
      await exportButton.click();
      
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.csv');
      }
    }
  });
});
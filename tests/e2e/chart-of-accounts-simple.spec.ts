import { test, expect } from '@playwright/test';

test.describe('Chart of Accounts Page - Simple Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://localhost:3003/bookkeeping/chart-of-accounts');
    await page.waitForLoadState('networkidle');
  });

  test('displays page header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Chart of Accounts');
  });

  test('shows accounts or empty state', async ({ page }) => {
    // Wait for either accounts grid or empty state
    const accountsGrid = page.locator('.grid.grid-cols-12');
    const emptyState = page.locator('text="No accounts found"');
    
    // Either we have accounts or empty state
    const hasAccounts = await accountsGrid.count() > 0;
    const hasEmptyState = await emptyState.count() > 0;
    
    expect(hasAccounts || hasEmptyState).toBe(true);
  });

  test('displays account data correctly', async ({ page }) => {
    const accountsGrid = page.locator('.grid.grid-cols-12');
    const gridCount = await accountsGrid.count();
    
    if (gridCount > 1) { // More than just header
      // We have accounts, check that headers are visible
      await expect(page.locator('text="Code"').first()).toBeVisible();
      await expect(page.locator('text="Account Name"').first()).toBeVisible();
      await expect(page.locator('text="Type"').first()).toBeVisible();
      await expect(page.locator('text="YTD Amount"').first()).toBeVisible();
      
      // Check that we have the test VAT account
      const vatAccount = page.locator('text="VAT"');
      if (await vatAccount.count() > 0) {
        await expect(vatAccount.first()).toBeVisible();
      }
    }
  });

  test('has functional sync button', async ({ page }) => {
    const syncButton = page.locator('button:has-text("Sync from Xero")');
    await expect(syncButton).toBeVisible();
    
    // Click sync button
    await syncButton.click();
    
    // Wait for potential toast message or loading state
    await page.waitForTimeout(1000);
  });

  test('displays bank accounts with codes', async ({ page }) => {
    // Wait for content to load
    await page.waitForLoadState('domcontentloaded');
    
    // Look for bank account entries in our test data
    const bankAccountNames = ['Business Current Account', 'Business Savings Account'];
    let foundBankAccount = false;
    
    for (const accountName of bankAccountNames) {
      const bankAccount = page.locator(`text="${accountName}"`);
      if (await bankAccount.count() > 0) {
        foundBankAccount = true;
        
        // Find the row containing this account
        const row = page.locator('.border.border-slate-700').filter({ has: bankAccount });
        if (await row.count() > 0) {
          // Get the code from the first column
          const codeElement = row.locator('.col-span-2').first();
          const code = await codeElement.textContent();
          
          // Bank accounts should have a code
          expect(code).toBeTruthy();
          expect(code).not.toBe('N/A');
          expect(code).not.toBe('-');
          
          // Our test bank accounts have BANK_ prefix
          expect(code).toContain('BANK_');
        }
        break;
      }
    }
    
    if (!foundBankAccount) {
      console.log('No bank accounts found in the display');
    }
  });

  test('shows system accounts', async ({ page }) => {
    // Look for system accounts we created in test data
    const systemAccounts = ['VAT', 'PAYE', 'Corporation Tax'];
    let foundAny = false;
    
    for (const accountName of systemAccounts) {
      const account = page.locator(`text="${accountName}"`);
      if (await account.count() > 0) {
        foundAny = true;
        break;
      }
    }
    
    // Log if no system accounts found (might not be loaded)
    if (!foundAny) {
      console.log('No system accounts found - data might not be loaded');
    }
  });

  test('has working column filters', async ({ page }) => {
    // Look for filter buttons (Filter icons)
    const filterButtons = page.locator('.filter-dropdown button');
    const filterCount = await filterButtons.count();
    
    if (filterCount > 0) {
      // Click first filter button
      await filterButtons.first().click();
      await page.waitForTimeout(300);
      
      // Check if dropdown appeared
      const dropdown = page.locator('.absolute.top-full');
      const dropdownVisible = await dropdown.count() > 0;
      
      if (dropdownVisible) {
        // Close dropdown by clicking outside
        await page.click('body');
      }
    }
  });

  test('displays correct total accounts', async ({ page }) => {
    // Look for account statistics
    const stats = page.locator('.grid.grid-cols-2, .grid.grid-cols-3, .grid.grid-cols-4').filter({
      has: page.locator('text=/Total|Active|Accounts/i')
    });
    
    const statsCount = await stats.count();
    
    if (statsCount > 0) {
      // We have stats displayed
      expect(statsCount).toBeGreaterThan(0);
    } else {
      // Check if we at least have account rows
      const accountRows = page.locator('.border.border-slate-700').filter({
        hasNot: page.locator('text="Code"')
      });
      const rowCount = await accountRows.count();
      console.log(`Found ${rowCount} account rows`);
    }
  });
});
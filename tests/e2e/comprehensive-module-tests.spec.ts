import { test, expect, Page, BrowserContext } from '@playwright/test';

const BASE_URL = 'https://localhost:3003';
const XERO_EMAIL = 'ajarrar@trademanenterprise.com';
const XERO_PASSWORD = 'gW2r4*8&wFM.#fZ';

test.describe('Comprehensive Module Tests', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // Create a persistent context to maintain session
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: './test-videos',
        size: { width: 1920, height: 1080 }
      }
    });
    page = await context.newPage();
    
    // Enable console logging for debugging
    page.on('console', msg => console.log(`Browser console: ${msg.text()}`));
    page.on('pageerror', err => console.log(`Browser error: ${err.message}`));
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('01. Navigate to Finance Dashboard and verify all components load', async () => {
    console.log('=== Testing Finance Dashboard ===');
    
    await page.goto(`${BASE_URL}/finance`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot of finance dashboard
    await page.screenshot({ path: 'screenshots/finance-dashboard.png', fullPage: true });
    
    // Verify main components are visible
    await expect(page.locator('h1:has-text("Financial Overview")')).toBeVisible({ timeout: 10000 });
    
    // Check for key financial sections
    const sections = [
      'Cash Balance',
      'Balance Sheet',
      'Profit & Loss',
      'Top Vendors by Spend'
    ];
    
    for (const section of sections) {
      console.log(`Checking for section: ${section}`);
      const sectionLocator = page.locator(`text=${section}`).first();
      await expect(sectionLocator).toBeVisible({ timeout: 5000 });
    }
    
    // Verify data is loading (check for either amounts or loading states)
    const balanceElement = page.locator('.text-3xl.font-bold').first();
    await expect(balanceElement).toBeVisible();
    const balanceText = await balanceElement.textContent();
    console.log(`Cash Balance: ${balanceText}`);
  });

  test('02. Navigate to Bookkeeping module and check Xero connection', async () => {
    console.log('=== Testing Bookkeeping Module ===');
    
    await page.goto(`${BASE_URL}/bookkeeping`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/bookkeeping-dashboard.png', fullPage: true });
    
    // Check if Xero is connected or needs connection
    const xeroStatus = await page.locator('text=/Connected|Connect Xero/i').first();
    const statusText = await xeroStatus.textContent();
    console.log(`Xero Status: ${statusText}`);
    
    if (statusText?.includes('Connect Xero')) {
      console.log('Xero not connected, attempting to connect...');
      await handleXeroAuth(page);
    } else {
      console.log('Xero already connected');
    }
    
    // Verify bookkeeping sections
    await expect(page.locator('text=Balance Sheet')).toBeVisible();
    await expect(page.locator('text=Profit & Loss')).toBeVisible();
    await expect(page.locator('text=VAT Liability')).toBeVisible();
  });

  test('03. Test Chart of Accounts functionality', async () => {
    console.log('=== Testing Chart of Accounts ===');
    
    // Navigate to Chart of Accounts
    await page.click('text=Chart of Accounts');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/chart-of-accounts.png', fullPage: true });
    
    // Check if accounts are loaded
    const accountsTable = page.locator('div[class*="divide-y"]').first();
    await expect(accountsTable).toBeVisible({ timeout: 10000 });
    
    // Try syncing from Xero
    const syncButton = page.locator('button:has-text("Sync from Xero")');
    if (await syncButton.isVisible()) {
      console.log('Syncing accounts from Xero...');
      await syncButton.click();
      
      // Wait for sync to complete
      await page.waitForTimeout(5000);
      
      // Check for success message
      const toastMessage = page.locator('.react-hot-toast').last();
      if (await toastMessage.isVisible()) {
        const message = await toastMessage.textContent();
        console.log(`Sync result: ${message}`);
      }
    }
    
    // Test filtering
    console.log('Testing account filtering...');
    const codeFilterButton = page.locator('button[class*="hover:bg-slate"]').first();
    await codeFilterButton.click();
    
    const filterInput = page.locator('input[placeholder="Filter codes..."]');
    await filterInput.fill('100');
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const filteredAccounts = await page.locator('div[class*="hover:bg-slate-800/50"]').count();
    console.log(`Filtered accounts count: ${filteredAccounts}`);
    
    // Clear filter
    await filterInput.clear();
    
    // Test CSV export
    const exportButton = page.locator('button:has-text("Export CSV")');
    if (await exportButton.isVisible()) {
      console.log('Testing CSV export...');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click()
      ]);
      console.log(`Downloaded: ${download.suggestedFilename()}`);
    }
  });

  test('04. Test Transactions page', async () => {
    console.log('=== Testing Transactions Page ===');
    
    // Navigate back to bookkeeping
    await page.goto(`${BASE_URL}/bookkeeping`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Click on Transactions
    await page.click('text=Transactions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/transactions.png', fullPage: true });
    
    // Check if transactions are loaded
    const transactionsContainer = page.locator('div[class*="rounded-xl"][class*="bg-slate"]').first();
    await expect(transactionsContainer).toBeVisible({ timeout: 10000 });
    
    // Test date filter
    console.log('Testing date filters...');
    const thisMonthButton = page.locator('button:has-text("This Month")');
    if (await thisMonthButton.isVisible()) {
      await thisMonthButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      console.log('Testing search...');
      await searchInput.fill('invoice');
      await page.waitForTimeout(1000);
      await searchInput.clear();
    }
    
    // Test transaction type filter
    const typeButtons = ['All', 'Money In', 'Money Out'];
    for (const buttonText of typeButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`).first();
      if (await button.isVisible()) {
        console.log(`Testing filter: ${buttonText}`);
        await button.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('05. Test Analytics page', async () => {
    console.log('=== Testing Analytics Page ===');
    
    // Navigate to Analytics
    await page.goto(`${BASE_URL}/bookkeeping`, { waitUntil: 'networkidle' });
    await page.click('text=Analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/analytics.png', fullPage: true });
    
    // Verify analytics components
    await expect(page.locator('h1:has-text("Financial Analytics")')).toBeVisible();
    
    // Check for vendor analysis
    const vendorSection = page.locator('text=Top Vendors by Spend').first();
    await expect(vendorSection).toBeVisible();
    
    // Test time period selector if available
    const periodSelectors = ['This Month', 'Last Month', 'This Quarter', 'This Year'];
    for (const period of periodSelectors) {
      const selector = page.locator(`button:has-text("${period}")`).first();
      if (await selector.isVisible()) {
        console.log(`Testing period: ${period}`);
        await selector.click();
        await page.waitForTimeout(2000);
        break;
      }
    }
  });

  test('06. Test Cash Flow module', async () => {
    console.log('=== Testing Cash Flow Module ===');
    
    await page.goto(`${BASE_URL}/cashflow`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/cashflow.png', fullPage: true });
    
    // Verify cash flow components
    await expect(page.locator('h1:has-text("Cash Flow Forecast")')).toBeVisible();
    
    // Check forecast period buttons
    const forecastButtons = ['30 Days', '60 Days', '90 Days'];
    for (const buttonText of forecastButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`).first();
      if (await button.isVisible()) {
        console.log(`Testing forecast period: ${buttonText}`);
        await button.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Check for forecast data
    const forecastContainer = page.locator('div[class*="bg-slate-800/30"]').first();
    if (await forecastContainer.isVisible()) {
      const hasData = await page.locator('text=/Receivables|Payables|Balance/').first().isVisible();
      console.log(`Cash flow data present: ${hasData}`);
    }
  });

  test('07. Test Xero Debug page', async () => {
    console.log('=== Testing Xero Debug Page ===');
    
    await page.goto(`${BASE_URL}/bookkeeping/xero-debug`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'screenshots/xero-debug.png', fullPage: true });
    
    // Test cookie access
    const cookieTestButton = page.locator('button:has-text("Test Cookie Access")');
    if (await cookieTestButton.isVisible()) {
      console.log('Testing cookie access...');
      await cookieTestButton.click();
      await page.waitForTimeout(2000);
      
      // Check result
      const cookieResult = page.locator('pre').first();
      if (await cookieResult.isVisible()) {
        const result = await cookieResult.textContent();
        console.log('Cookie test result received');
      }
    }
    
    // Test connection status
    const statusButton = page.locator('button:has-text("Test Status Endpoint")');
    if (await statusButton.isVisible()) {
      console.log('Testing status endpoint...');
      await statusButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('08. Test responsive design', async () => {
    console.log('=== Testing Responsive Design ===');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/finance`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/finance-mobile.png', fullPage: true });
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE_URL}/bookkeeping`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/bookkeeping-tablet.png', fullPage: true });
    
    // Reset to desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('09. Test navigation and routing', async () => {
    console.log('=== Testing Navigation ===');
    
    // Test all main navigation links
    const routes = [
      { path: '/finance', title: 'Financial Overview' },
      { path: '/bookkeeping', title: 'Bookkeeping Dashboard' },
      { path: '/cashflow', title: 'Cash Flow Forecast' }
    ];
    
    for (const route of routes) {
      console.log(`Testing route: ${route.path}`);
      await page.goto(`${BASE_URL}${route.path}`);
      await page.waitForLoadState('networkidle');
      
      // Verify we're on the correct page
      await expect(page.locator(`h1:has-text("${route.title}")`)).toBeVisible({ timeout: 10000 });
    }
    
    // Test back navigation
    await page.goto(`${BASE_URL}/bookkeeping/chart-of-accounts`);
    await page.click('text=Back to Dashboard');
    await expect(page).toHaveURL(`${BASE_URL}/bookkeeping`);
  });

  test('10. Performance and error monitoring', async () => {
    console.log('=== Testing Performance ===');
    
    // Measure page load times
    const pages = ['/finance', '/bookkeeping', '/cashflow'];
    
    for (const pagePath of pages) {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`${pagePath} load time: ${loadTime}ms`);
      
      // Check for console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(2000);
      
      if (errors.length > 0) {
        console.log(`Errors on ${pagePath}:`, errors);
      }
    }
  });
});

// Helper function to handle Xero authentication
async function handleXeroAuth(page: Page) {
  try {
    // Click Connect Xero button
    await page.click('button:has-text("Connect Xero")');
    
    // Wait for new page/popup
    const newPagePromise = page.context().waitForEvent('page');
    const newPage = await newPagePromise;
    
    // Wait for Xero login page
    await newPage.waitForURL('**/login.xero.com/**', { timeout: 30000 });
    
    // Fill in credentials
    await newPage.fill('input[type="email"]', XERO_EMAIL);
    await newPage.click('button:has-text("Next")');
    
    await newPage.waitForSelector('input[type="password"]', { timeout: 10000 });
    await newPage.fill('input[type="password"]', XERO_PASSWORD);
    await newPage.click('button[type="submit"]');
    
    // Handle 2FA if needed
    try {
      await newPage.waitForURL('**/login.xero.com/identity/user/login/twofactor**', { timeout: 5000 });
      console.log('2FA required - manual intervention needed');
      // Wait for manual 2FA completion
      await newPage.waitForURL(`${BASE_URL}/**`, { timeout: 120000 });
    } catch {
      console.log('No 2FA required');
    }
    
    // Handle authorization
    try {
      await newPage.waitForSelector('button:has-text("Allow access")', { timeout: 10000 });
      await newPage.click('button:has-text("Allow access")');
    } catch {
      console.log('Authorization auto-approved or not needed');
    }
    
    // Wait for redirect back
    await page.waitForURL(`${BASE_URL}/**`, { timeout: 30000 });
    console.log('Xero authentication completed');
    
  } catch (error) {
    console.error('Xero authentication failed:', error);
  }
}
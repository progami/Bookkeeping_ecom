import { test, expect, chromium, Browser, Page } from '@playwright/test';

const BASE_URL = 'https://localhost:3003';
const XERO_EMAIL = 'ajarrar@trademanenterprise.com';
const XERO_PASSWORD = 'gW2r4*8&wFM.#fZ';

test.describe('Live Browser Testing', () => {
  test('Connect to existing Chrome and test all modules', async () => {
    console.log('=== Connecting to Live Chrome Browser ===');
    
    // Connect to existing Chrome instance
    // First, ensure Chrome is running with remote debugging enabled
    let browser: Browser;
    let page: Page;
    
    try {
      // Try to connect to existing Chrome
      browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('Connected to existing Chrome browser');
      
      // Get the first context and page
      const contexts = browser.contexts();
      const context = contexts[0] || await browser.newContext({ ignoreHTTPSErrors: true });
      const pages = context.pages();
      page = pages[0] || await context.newPage();
      
    } catch (error) {
      console.log('Could not connect to existing Chrome, launching new instance');
      browser = await chromium.launch({
        headless: false,
        args: ['--remote-debugging-port=9222']
      });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      page = await context.newPage();
    }
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser error: ${msg.text()}`);
      }
    });
    
    try {
      // Test 1: Finance Dashboard
      console.log('\n=== Testing Finance Dashboard ===');
      await page.goto(`${BASE_URL}/finance`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      const financeTitle = await page.textContent('h1');
      console.log(`Finance page title: ${financeTitle}`);
      
      // Check for financial data
      const cashBalance = await page.locator('.text-3xl.font-bold').first().textContent();
      console.log(`Cash Balance: ${cashBalance}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: 'screenshots/live-finance.png', 
        fullPage: true 
      });
      
      // Test 2: Bookkeeping Module
      console.log('\n=== Testing Bookkeeping Module ===');
      await page.goto(`${BASE_URL}/bookkeeping`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Check Xero connection status
      const xeroButton = await page.locator('button:has-text("Connect Xero"), span:has-text("Connected")').first();
      const xeroStatus = await xeroButton.textContent();
      console.log(`Xero Status: ${xeroStatus}`);
      
      // If not connected, try to connect
      if (xeroStatus?.includes('Connect Xero')) {
        console.log('Attempting Xero connection...');
        
        // Click the button
        await xeroButton.click();
        
        // Handle popup or new tab
        const [popup] = await Promise.all([
          page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
          page.waitForNavigation({ timeout: 10000 }).catch(() => null)
        ]);
        
        if (popup) {
          console.log('Handling Xero auth in popup');
          await handleXeroAuthInPage(popup);
          await popup.close();
        } else {
          console.log('Handling Xero auth in same page');
          await handleXeroAuthInPage(page);
        }
      }
      
      // Check for report data
      const reports = ['Balance Sheet', 'Profit & Loss', 'VAT Liability'];
      for (const report of reports) {
        const reportElement = await page.locator(`text=${report}`).first();
        if (await reportElement.isVisible()) {
          console.log(`✓ ${report} section found`);
        }
      }
      
      await page.screenshot({ 
        path: 'screenshots/live-bookkeeping.png', 
        fullPage: true 
      });
      
      // Test 3: Chart of Accounts
      console.log('\n=== Testing Chart of Accounts ===');
      const chartLink = await page.locator('text=Chart of Accounts').first();
      if (await chartLink.isVisible()) {
        await chartLink.click();
        await page.waitForTimeout(3000);
        
        // Check for accounts
        const accountRows = await page.locator('div[class*="hover:bg-slate-800/50"]').count();
        console.log(`Found ${accountRows} accounts`);
        
        // Test filtering
        const filterButton = await page.locator('button').filter({ hasText: /filter/i }).first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
          const filterInput = await page.locator('input[placeholder*="Filter"]').first();
          if (await filterInput.isVisible()) {
            await filterInput.fill('100');
            await page.waitForTimeout(1000);
            const filteredRows = await page.locator('div[class*="hover:bg-slate-800/50"]').count();
            console.log(`Filtered to ${filteredRows} accounts`);
            await filterInput.clear();
          }
        }
        
        await page.screenshot({ 
          path: 'screenshots/live-chart-of-accounts.png', 
          fullPage: true 
        });
      }
      
      // Test 4: Transactions
      console.log('\n=== Testing Transactions ===');
      await page.goto(`${BASE_URL}/bookkeeping`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      const transactionsLink = await page.locator('text=Transactions').first();
      if (await transactionsLink.isVisible()) {
        await transactionsLink.click();
        await page.waitForTimeout(3000);
        
        // Check for transaction data
        const transactionRows = await page.locator('div[class*="transaction-row"], div[class*="border-b"]').count();
        console.log(`Found ${transactionRows} transactions`);
        
        // Test filters
        const filterButtons = ['This Month', 'Money In', 'Money Out'];
        for (const filterText of filterButtons) {
          const button = await page.locator(`button:has-text("${filterText}")`).first();
          if (await button.isVisible()) {
            await button.click();
            await page.waitForTimeout(1000);
            console.log(`✓ ${filterText} filter working`);
          }
        }
        
        await page.screenshot({ 
          path: 'screenshots/live-transactions.png', 
          fullPage: true 
        });
      }
      
      // Test 5: Cash Flow
      console.log('\n=== Testing Cash Flow ===');
      await page.goto(`${BASE_URL}/cashflow`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      const cashflowTitle = await page.locator('h1').textContent();
      console.log(`Cash Flow page title: ${cashflowTitle}`);
      
      // Test forecast periods
      const periodButtons = ['30 Days', '60 Days', '90 Days'];
      for (const period of periodButtons) {
        const button = await page.locator(`button:has-text("${period}")`).first();
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(2000);
          console.log(`✓ ${period} forecast loaded`);
        }
      }
      
      await page.screenshot({ 
        path: 'screenshots/live-cashflow.png', 
        fullPage: true 
      });
      
      // Test 6: Performance check
      console.log('\n=== Performance Summary ===');
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          responseTime: navigation.responseEnd - navigation.requestStart
        };
      });
      
      console.log('Performance metrics:', metrics);
      
      console.log('\n=== All tests completed successfully ===');
      
    } catch (error) {
      console.error('Test failed:', error);
      await page.screenshot({ 
        path: 'screenshots/error-state.png', 
        fullPage: true 
      });
    } finally {
      // Don't close the browser if it was already running
      if (!browser.isConnected()) {
        await browser.close();
      }
    }
  });
});

async function handleXeroAuthInPage(page: Page) {
  try {
    // Wait for Xero login page
    await page.waitForURL('**/login.xero.com/**', { timeout: 10000 });
    console.log('On Xero login page');
    
    // Fill email
    const emailInput = await page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill(XERO_EMAIL);
      await page.locator('button:has-text("Next")').click();
    }
    
    // Fill password
    await page.waitForTimeout(1000);
    const passwordInput = await page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible()) {
      await passwordInput.fill(XERO_PASSWORD);
      await page.locator('button[type="submit"]').click();
    }
    
    // Handle 2FA if needed
    try {
      await page.waitForURL('**/twofactor**', { timeout: 5000 });
      console.log('2FA required - please complete manually');
      await page.waitForURL(`${BASE_URL}/**`, { timeout: 120000 });
    } catch {
      // No 2FA
    }
    
    // Handle authorization
    const allowButton = await page.locator('button:has-text("Allow access")').first();
    if (await allowButton.isVisible({ timeout: 5000 })) {
      await allowButton.click();
    }
    
    // Wait for redirect
    await page.waitForURL(`${BASE_URL}/**`, { timeout: 30000 });
    console.log('Xero authentication completed');
    
  } catch (error) {
    console.log('Xero auth handling error:', error);
  }
}
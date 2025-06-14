import { chromium } from 'playwright';

async function authenticateXero() {
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();

  try {
    console.log('Navigating to bookkeeping app...');
    await page.goto('https://localhost:3003/bookkeeping');
    
    // Click Connect Xero button
    console.log('Looking for Connect Xero button...');
    await page.click('button:has-text("Connect Xero")');
    
    // Wait for Xero login page
    console.log('Waiting for Xero login page...');
    await page.waitForURL('**/login.xero.com/**', { timeout: 30000 });
    
    // Fill in credentials
    console.log('Filling in credentials...');
    await page.fill('input[type="email"]', 'ajarrar@trademanenterprise.com');
    await page.click('button:has-text("Next")');
    
    // Wait for password field
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', 'gW2r4*8&wFM.#fZ');
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Handle any 2FA if required
    console.log('Checking for 2FA...');
    try {
      await page.waitForURL('**/login.xero.com/identity/user/login/twofactor**', { timeout: 5000 });
      console.log('2FA required - please complete manually');
      // Wait for user to complete 2FA
      await page.waitForURL('**/localhost:3003/**', { timeout: 120000 });
    } catch {
      // No 2FA required
      console.log('No 2FA required');
    }
    
    // Wait for authorization page
    console.log('Waiting for authorization...');
    try {
      await page.waitForSelector('button:has-text("Allow access")', { timeout: 10000 });
      await page.click('button:has-text("Allow access")');
    } catch {
      console.log('Authorization might have been auto-approved');
    }
    
    // Wait for redirect back to app
    console.log('Waiting for redirect back to app...');
    await page.waitForURL('**/localhost:3003/**', { timeout: 30000 });
    
    console.log('Authentication successful!');
    
    // Verify connection
    await page.goto('https://localhost:3003/api/v1/xero/status');
    const statusText = await page.textContent('body');
    console.log('Xero status:', statusText);
    
  } catch (error) {
    console.error('Authentication failed:', error);
  } finally {
    await browser.close();
  }
}

authenticateXero();
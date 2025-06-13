const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--ignore-certificate-errors']
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  console.log('Navigating to bookkeeping page...');
  await page.goto('https://localhost:3003/bookkeeping');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Check if there's a connect to Xero button
  const connectButton = await page.locator('text="Connect to Xero"').first();
  if (await connectButton.isVisible()) {
    console.log('Found Connect to Xero button, clicking...');
    await connectButton.click();
    
    // Wait for redirect to Xero
    await page.waitForLoadState('networkidle');
    
    // Check if we're on Xero login page
    if (page.url().includes('login.xero.com')) {
      console.log('Redirected to Xero login page');
      console.log('Current URL:', page.url());
      
      // Fill in credentials
      await page.fill('input[type="email"]', 'ajarrar@trademanenterprise.com');
      await page.click('button[type="submit"]');
      
      await page.waitForTimeout(2000);
      
      // Fill password
      await page.fill('input[type="password"]', 'gW2r4*8&wFM.#fZ');
      await page.click('button[type="submit"]');
      
      console.log('Credentials submitted, waiting for response...');
      
      // Wait for OAuth callback
      await page.waitForURL('**/bookkeeping**', { timeout: 30000 });
      
      console.log('Authentication complete!');
      console.log('Final URL:', page.url());
    }
  } else {
    console.log('Already connected or no connect button found');
    console.log('Current URL:', page.url());
  }
  
  // Keep browser open for inspection
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
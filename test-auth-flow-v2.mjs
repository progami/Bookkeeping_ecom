import { chromium } from 'playwright';

async function testAuthFlow() {
  console.log('Starting auth flow test v2...');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    // Store auth state to avoid re-login
    storageState: {
      cookies: [],
      origins: []
    }
  });
  
  const page = await context.newPage();

  // Monitor console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('[AuthContext]')) {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    }
  });

  // Monitor network requests to API
  page.on('response', response => {
    if (response.url().includes('/api/v1/xero/')) {
      console.log(`[API Response] ${response.url()} - ${response.status()}`);
    }
  });

  try {
    // 1. Start from bookkeeping page (where auth management is)
    console.log('\n1. Going to bookkeeping page...');
    await page.goto('https://localhost:3003/bookkeeping');
    await page.waitForLoadState('networkidle');
    
    // Check initial state
    const hasReconnect = await page.locator('button:has-text("Reconnect to Xero")').isVisible().catch(() => false);
    const hasConnect = await page.locator('text=Connect to Xero').isVisible().catch(() => false);
    
    console.log('Initial state - Reconnect button:', hasReconnect);
    console.log('Initial state - Connect prompt:', hasConnect);
    
    // If already connected, disconnect first
    if (hasReconnect) {
      console.log('\n2. Already connected, disconnecting first...');
      // Look for the disconnect button in the header
      const disconnectBtn = page.locator('button:has-text("Disconnect")');
      if (await disconnectBtn.isVisible()) {
        await disconnectBtn.click();
        
        // Handle confirmation
        page.once('dialog', async dialog => {
          console.log('Confirming disconnect...');
          await dialog.accept();
        });
        
        await page.waitForTimeout(3000);
        console.log('Disconnected successfully');
      }
    }
    
    // 3. Now test connect flow
    console.log('\n3. Testing connect flow...');
    
    // Click reconnect/connect button
    const reconnectBtn = await page.locator('button:has-text("Reconnect to Xero")').isVisible();
    if (reconnectBtn) {
      await page.click('button:has-text("Reconnect to Xero")');
    } else {
      // Try other connect buttons
      await page.click('text=Connect to Xero').first();
    }
    
    await page.waitForTimeout(2000);
    
    // Check if redirected to Xero
    if (page.url().includes('login.xero.com')) {
      console.log('✓ Redirected to Xero login');
      
      // Login to Xero
      await page.fill('input[name="Username"]', 'ajarrar@trademanenterprise.com');
      await page.fill('input[name="Password"]', 'gW2r4*8&wFM.#fZ');
      await page.click('button[type="submit"]');
      
      console.log('Credentials submitted, waiting for redirect...');
      
      // Wait for redirect back
      await page.waitForURL(/localhost:3003/, { timeout: 60000 });
      console.log('✓ Redirected back to app');
    }
    
    // 4. Verify connected state
    console.log('\n4. Verifying connected state...');
    await page.waitForLoadState('networkidle');
    
    // Go to finance page to check
    await page.goto('https://localhost:3003/finance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Should NOT show welcome screen
    const welcomeHidden = await page.locator('text=Welcome to Your Financial Hub').isHidden().catch(() => true);
    console.log('✓ Welcome screen hidden:', welcomeHidden);
    
    // Should show financial data
    const hasFinancialOverview = await page.locator('text=Financial Overview').isVisible().catch(() => false);
    const hasHealthScore = await page.locator('text=Financial Health Score').isVisible().catch(() => false);
    console.log('✓ Shows Financial Overview:', hasFinancialOverview);
    console.log('✓ Shows Health Score:', hasHealthScore);
    
    // 5. Test disconnect from finance page
    console.log('\n5. Testing disconnect from finance page...');
    const disconnectBtn = page.locator('button:has-text("Disconnect")');
    
    if (await disconnectBtn.isVisible()) {
      console.log('Found disconnect button, clicking...');
      
      // Setup dialog handler before clicking
      page.once('dialog', async dialog => {
        console.log('Dialog appeared:', dialog.message());
        await dialog.accept();
      });
      
      await disconnectBtn.click();
      await page.waitForTimeout(3000);
      
      // Should show welcome screen again
      const welcomeBack = await page.locator('text=Welcome to Your Financial Hub').isVisible().catch(() => false);
      console.log('✓ Shows welcome screen after disconnect:', welcomeBack);
    } else {
      console.log('⚠️  No disconnect button found');
    }
    
    console.log('\n✅ Test completed!');
    
    // Save final screenshot
    await page.screenshot({ path: 'test-success.png', fullPage: true });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take screenshot on failure
    await page.screenshot({ path: 'test-failure-v2.png', fullPage: true });
    console.log('Screenshot saved as test-failure-v2.png');
    
    // Log current URL
    console.log('Current URL:', page.url());
  } finally {
    console.log('\nClosing browser in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

testAuthFlow().catch(console.error);
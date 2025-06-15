import { chromium } from 'playwright';

async function testUIUpdates() {
  console.log('Testing UI update behavior...');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();

  // Monitor console for AuthContext updates
  page.on('console', msg => {
    if (msg.text().includes('[AuthContext]')) {
      console.log(`[AuthContext Log]: ${msg.text()}`);
    }
  });

  try {
    // 1. Test Finance page UI updates
    console.log('\n1. Testing Finance page...');
    await page.goto('https://localhost:3003/finance');
    await page.waitForLoadState('networkidle');
    
    // Check initial state
    const initialState = {
      hasWelcome: await page.locator('text=Welcome to Your Financial Hub').isVisible().catch(() => false),
      hasFinancialOverview: await page.locator('text=Financial Overview').isVisible().catch(() => false),
      hasDisconnect: await page.locator('button:has-text("Disconnect")').isVisible().catch(() => false),
      hasConnect: await page.locator('button:has-text("Connect to Xero")').isVisible().catch(() => false)
    };
    
    console.log('Initial state:', initialState);
    
    // If connected, test disconnect
    if (initialState.hasDisconnect) {
      console.log('\n2. Testing disconnect behavior...');
      
      // Setup dialog handler
      page.once('dialog', async dialog => {
        console.log('Dialog:', dialog.message());
        await dialog.accept();
      });
      
      // Click disconnect
      await page.click('button:has-text("Disconnect")');
      
      // Wait for state update
      await page.waitForTimeout(1000);
      
      // Check UI updated
      const afterDisconnect = {
        hasWelcome: await page.locator('text=Welcome to Your Financial Hub').isVisible().catch(() => false),
        hasFinancialOverview: await page.locator('text=Financial Overview').isVisible().catch(() => false),
        hasDisconnect: await page.locator('button:has-text("Disconnect")').isVisible().catch(() => false),
        hasConnect: await page.locator('button:has-text("Connect to Xero")').isVisible().catch(() => false)
      };
      
      console.log('After disconnect:', afterDisconnect);
      console.log('✅ UI updated correctly:', afterDisconnect.hasWelcome && afterDisconnect.hasConnect && !afterDisconnect.hasDisconnect);
    }
    
    // 3. Test navigation between pages
    console.log('\n3. Testing navigation to other pages...');
    
    // Go to bookkeeping
    await page.goto('https://localhost:3003/bookkeeping');
    await page.waitForLoadState('networkidle');
    
    const bookkeepingState = {
      hasReconnect: await page.locator('button:has-text("Reconnect to Xero")').isVisible().catch(() => false),
      hasWarning: await page.locator('text=Xero connection expired').isVisible().catch(() => false)
    };
    
    console.log('Bookkeeping page state:', bookkeepingState);
    
    // Go to analytics
    await page.goto('https://localhost:3003/analytics');
    await page.waitForLoadState('networkidle');
    
    const analyticsState = {
      hasEmptyState: await page.locator('text=No Vendor Data Available').isVisible().catch(() => false),
      hasData: await page.locator('text=Top Vendors by Spend').isVisible().catch(() => false)
    };
    
    console.log('Analytics page state:', analyticsState);
    
    // 4. Test simulated connection (without actual Xero auth)
    console.log('\n4. Simulating connection callback...');
    await page.goto('https://localhost:3003/finance?connected=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const afterConnect = {
      hasWelcome: await page.locator('text=Welcome to Your Financial Hub').isVisible().catch(() => false),
      hasFinancialOverview: await page.locator('text=Financial Overview').isVisible().catch(() => false),
      hasDisconnect: await page.locator('button:has-text("Disconnect")').isVisible().catch(() => false),
      hasConnect: await page.locator('button:has-text("Connect to Xero")').isVisible().catch(() => false)
    };
    
    console.log('After simulated connect:', afterConnect);
    
    console.log('\n✅ Test completed!');
    
    // Take final screenshot
    await page.screenshot({ path: 'ui-test-final.png', fullPage: true });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ path: 'ui-test-error.png', fullPage: true });
  } finally {
    console.log('\nClosing browser in 3 seconds...');
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

testUIUpdates().catch(console.error);
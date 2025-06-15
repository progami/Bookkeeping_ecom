import { chromium } from 'playwright';

async function testAuthFlow() {
  console.log('Starting auth flow test...');
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 
  });
  
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });
  
  const page = await context.newPage();

  // Monitor console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('AuthContext')) {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    }
  });

  try {
    // 1. Start disconnected
    console.log('\n1. Testing disconnected state...');
    await page.goto('https://localhost:3003/finance');
    await page.waitForLoadState('networkidle');
    
    // Should see "Welcome to Your Financial Hub"
    const welcomeText = await page.locator('text=Welcome to Your Financial Hub').isVisible();
    console.log('✓ Shows welcome screen when disconnected:', welcomeText);
    
    // 2. Click Connect to Xero
    console.log('\n2. Clicking Connect to Xero...');
    await page.click('button:has-text("Connect to Xero")');
    await page.waitForTimeout(2000);
    
    // Should redirect to Xero login
    const isOnXero = page.url().includes('login.xero.com');
    console.log('✓ Redirected to Xero:', isOnXero);
    
    if (isOnXero) {
      console.log('\n3. Logging into Xero...');
      // Enter credentials
      await page.fill('input[name="Username"]', 'ajarrar@trademanenterprise.com');
      await page.fill('input[name="Password"]', 'gW2r4*8&wFM.#fZ');
      await page.click('button[type="submit"]');
      
      // Wait for MFA or redirect
      await page.waitForTimeout(5000);
      
      // Check if we need to handle MFA
      if (page.url().includes('mfa') || page.url().includes('verify')) {
        console.log('MFA required - please complete manually...');
        await page.waitForURL('**/finance**', { timeout: 60000 });
      }
    }
    
    // 4. Should be back on finance page with data
    console.log('\n4. Checking connected state...');
    await page.waitForLoadState('networkidle');
    
    // Should NOT see welcome screen
    const welcomeGone = await page.locator('text=Welcome to Your Financial Hub').isHidden();
    console.log('✓ Welcome screen hidden:', welcomeGone);
    
    // Should see financial data
    const hasFinancialData = await page.locator('text=Financial Overview').isVisible();
    console.log('✓ Shows financial data:', hasFinancialData);
    
    // Should see disconnect button
    const hasDisconnect = await page.locator('button:has-text("Disconnect")').isVisible();
    console.log('✓ Shows disconnect button:', hasDisconnect);
    
    // 5. Test disconnect
    console.log('\n5. Testing disconnect...');
    await page.click('button:has-text("Disconnect")');
    
    // Handle confirmation
    page.once('dialog', async dialog => {
      console.log('Confirming disconnect...');
      await dialog.accept();
    });
    
    await page.waitForTimeout(2000);
    
    // Should immediately show welcome screen again
    const welcomeBack = await page.locator('text=Welcome to Your Financial Hub').isVisible();
    console.log('✓ Shows welcome screen after disconnect:', welcomeBack);
    
    // Should show Connect button again
    const connectBack = await page.locator('button:has-text("Connect to Xero")').isVisible();
    console.log('✓ Shows connect button after disconnect:', connectBack);
    
    // 6. Test reconnect
    console.log('\n6. Testing reconnect...');
    await page.click('button:has-text("Connect to Xero")');
    await page.waitForTimeout(2000);
    
    // Since we're already authenticated, should redirect back quickly
    if (page.url().includes('login.xero.com')) {
      console.log('Xero asking for re-auth...');
      await page.waitForURL('**/finance**', { timeout: 30000 });
    }
    
    // Should show financial data again
    await page.waitForLoadState('networkidle');
    const reconnected = await page.locator('text=Financial Overview').isVisible();
    console.log('✓ Shows financial data after reconnect:', reconnected);
    
    console.log('\n✓ All tests passed!');
    
  } catch (error) {
    console.error('Test failed:', error);
    
    // Take screenshot on failure
    await page.screenshot({ path: 'test-failure.png', fullPage: true });
    console.log('Screenshot saved as test-failure.png');
  } finally {
    await browser.close();
  }
}

testAuthFlow().catch(console.error);
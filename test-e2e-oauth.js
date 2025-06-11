const puppeteer = require('puppeteer');

async function testE2EOAuth() {
  console.log('Starting end-to-end OAuth test...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Enable request interception to monitor OAuth flow
    await page.setRequestInterception(true);
    
    let authUrl = null;
    let callbackUrl = null;
    
    page.on('request', request => {
      const url = request.url();
      
      // Capture auth URL
      if (url.includes('login.xero.com') && url.includes('state=')) {
        authUrl = url;
        console.log('Auth URL captured:', url);
        const urlObj = new URL(url);
        console.log('State in auth URL:', urlObj.searchParams.get('state'));
      }
      
      // Capture callback URL
      if (url.includes('/api/v1/xero/auth/callback') && url.includes('code=')) {
        callbackUrl = url;
        console.log('\nCallback URL captured:', url);
        const urlObj = new URL(url);
        console.log('State in callback:', urlObj.searchParams.get('state'));
        console.log('Code in callback:', urlObj.searchParams.get('code'));
      }
      
      request.continue();
    });
    
    // Navigate to the bookkeeping page
    console.log('Navigating to bookkeeping page...');
    await page.goto('http://localhost:3003/bookkeeping', { waitUntil: 'networkidle2' });
    
    // Click the "Connect Xero" button
    console.log('\nLooking for Connect Xero button...');
    const connectButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const button = buttons.find(b => b.textContent.includes('Connect Xero'));
      if (button) {
        button.click();
        return true;
      }
      return false;
    });
    
    if (connectButton) {
      console.log('Found and clicked Connect to Xero button');
      
      // Wait a bit to see if we get redirected
      await new Promise(r => setTimeout(r, 2000));
      
      const currentUrl = page.url();
      console.log('\nCurrent URL:', currentUrl);
      
      if (currentUrl.includes('login.xero.com')) {
        console.log('✅ Successfully redirected to Xero login page!');
        console.log('OAuth flow initiated correctly.');
        
        // Extract state from URL
        const urlObj = new URL(currentUrl);
        const state = urlObj.searchParams.get('state');
        console.log('State parameter present:', state ? '✅ Yes' : '❌ No');
        console.log('State value:', state);
      }
    } else {
      // Check if already connected
      const hasTransactionsButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('View Transactions'));
      });
      
      if (hasTransactionsButton) {
        console.log('⚠️  Xero is already connected (View Transactions button found)');
        
        // Try to disconnect first
        const disconnected = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const disconnectBtn = buttons.find(b => b.textContent.includes('Disconnect'));
          if (disconnectBtn) {
            disconnectBtn.click();
            return true;
          }
          return false;
        });
        
        if (disconnected) {
          console.log('Found and clicked disconnect button');
          await new Promise(r => setTimeout(r, 1000));
        }
      } else {
        console.log('❌ Connect to Xero button not found');
        
        // Debug: show what's on the page
        const pageContent = await page.evaluate(() => {
          return {
            buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()),
            title: document.title,
            hasError: window.location.search.includes('error')
          };
        });
        console.log('\nPage debug info:', pageContent);
      }
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testE2EOAuth().catch(console.error);
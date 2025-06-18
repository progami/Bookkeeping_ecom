import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const devLogPath = path.join(logsDir, 'development.log');

console.log('=== COMPREHENSIVE LOGGING TEST ===\n');
console.log('This test will:');
console.log('1. Login with test user');
console.log('2. Navigate through all pages');
console.log('3. Logout');
console.log('4. Login again with Xero user');
console.log('5. Connect to Xero');
console.log('6. Navigate through pages while connected\n');

// Take screenshots
async function screenshot(page, name) {
  await page.screenshot({ 
    path: `screenshots/logging-test-${name}-${Date.now()}.png`,
    fullPage: true 
  });
}

// Read log file and count lines
function getLogStatus() {
  const content = fs.readFileSync(devLogPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  return { totalLines: lines.length, content };
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 500
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true
});

const page = await context.newPage();

// Monitor console
const consoleLogs = [];
page.on('console', msg => {
  const text = msg.text();
  const type = msg.type();
  consoleLogs.push({ 
    time: new Date().toISOString(), 
    type, 
    text 
  });
});

let startLogs;
try {
  startLogs = getLogStatus();
  console.log(`Starting with ${startLogs.totalLines} lines in development.log\n`);

  // PHASE 1: Login with test user
  console.log('=== PHASE 1: Login with test user ===');
  await page.goto('https://localhost:3003/login');
  await screenshot(page, '01-login-page');
  
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);
  const afterLoginUrl = page.url();
  console.log(`After login URL: ${afterLoginUrl}`);
  await screenshot(page, '02-after-login');
  
  // PHASE 2: Navigate through all pages
  console.log('\n=== PHASE 2: Navigate through pages ===');
  
  // Finance
  console.log('- Navigating to Finance...');
  await page.click('a[href="/finance"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '03-finance');
  
  // Bookkeeping
  console.log('- Navigating to Bookkeeping...');
  await page.click('a[href="/bookkeeping"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '04-bookkeeping');
  
  // Cash Flow
  console.log('- Navigating to Cash Flow...');
  await page.click('a[href="/cashflow"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '05-cashflow');
  
  // Analytics
  console.log('- Navigating to Analytics...');
  await page.click('a[href="/analytics"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '06-analytics');
  
  // Database
  console.log('- Navigating to Database...');
  await page.click('a[href="/database-schema"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '07-database');
  
  // PHASE 3: Logout
  console.log('\n=== PHASE 3: Logout ===');
  await page.click('button:has-text("Sign Out")');
  await page.waitForTimeout(2000);
  console.log('Logged out, URL:', page.url());
  await screenshot(page, '08-after-logout');
  
  // PHASE 4: Login with Xero user
  console.log('\n=== PHASE 4: Login with Xero user ===');
  await page.goto('https://localhost:3003/login');
  await page.fill('input[type="email"]', 'ajarrar@trademanenterprise.com');
  await page.fill('input[type="password"]', 'gW2r4*8&wFM.#fZ');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);
  console.log('After Xero login URL:', page.url());
  await screenshot(page, '09-xero-login');
  
  // PHASE 5: Connect to Xero (if on connect page)
  if (page.url().includes('/connect')) {
    console.log('\n=== PHASE 5: Connect to Xero ===');
    console.log('On connect page, clicking Connect to Xero...');
    
    // Click connect button
    const connectButton = await page.locator('button:has-text("Connect to Xero")').first();
    if (await connectButton.isVisible()) {
      await connectButton.click();
      console.log('Clicked Connect to Xero button');
      
      // Wait for Xero auth page or redirect
      await page.waitForTimeout(5000);
      console.log('Current URL after connect:', page.url());
      
      // If redirected to Xero, handle auth
      if (page.url().includes('login.xero.com')) {
        console.log('On Xero auth page - would need manual interaction');
        await screenshot(page, '10-xero-auth');
      }
    }
  } else {
    console.log('\n=== PHASE 5: Already connected to Xero ===');
  }
  
  // PHASE 6: Navigate while connected
  console.log('\n=== PHASE 6: Navigate pages while connected ===');
  
  // Go to Finance
  await page.goto('https://localhost:3003/finance');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('- Finance page loaded');
  
  // Go to Bookkeeping
  await page.goto('https://localhost:3003/bookkeeping');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('- Bookkeeping page loaded');
  
  // Wait for any buffered logs
  console.log('\n=== Waiting for buffered logs to flush ===');
  await page.waitForTimeout(3000);
  
} catch (error) {
  console.error('Test error:', error.message);
  await screenshot(page, 'error');
} finally {
  await browser.close();
  
  // Analyze logs
  const endLogs = getLogStatus();
  console.log('\n=== LOG ANALYSIS ===');
  console.log(`Total lines: ${endLogs.totalLines} (added ${endLogs.totalLines - (startLogs?.totalLines || 0)})`);
  
  // Check for duplicates by looking for consecutive identical messages
  const lines = endLogs.content.split('\n').filter(line => line.trim());
  let duplicates = 0;
  
  for (let i = 1; i < lines.length; i++) {
    // Extract message part after timestamp and module
    const prevMsg = lines[i-1].replace(/^\[[^\]]+\] \[[^\]]+\] \[[^\]]+\] - /, '');
    const currMsg = lines[i].replace(/^\[[^\]]+\] \[[^\]]+\] \[[^\]]+\] - /, '');
    
    if (prevMsg === currMsg && prevMsg !== '') {
      duplicates++;
      console.log(`\nDuplicate found at line ${i}:`);
      console.log(`  Line ${i}: ${lines[i-1]}`);
      console.log(`  Line ${i+1}: ${lines[i]}`);
    }
  }
  
  if (duplicates === 0) {
    console.log('\n✅ No duplicate logs found!');
  } else {
    console.log(`\n❌ Found ${duplicates} duplicate log entries`);
  }
  
  // Show last 10 logs
  console.log('\n=== LAST 10 LOGS ===');
  lines.slice(-10).forEach(line => console.log(line));
  
  // Check browser console logs
  console.log(`\n=== BROWSER CONSOLE: ${consoleLogs.length} messages ===`);
  if (consoleLogs.length > 0) {
    console.log('Last 5 browser console messages:');
    consoleLogs.slice(-5).forEach(log => 
      console.log(`  [${log.type}] ${log.text.substring(0, 100)}...`)
    );
  }
  
  console.log('\n✓ Test completed!');
}
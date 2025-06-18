import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const devLogPath = path.join(logsDir, 'development.log');

console.log('=== QUICK LOGGING TEST ===\n');

// Ensure screenshots directory exists
const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Read initial log state
let startLines = 0;
if (fs.existsSync(devLogPath)) {
  const content = fs.readFileSync(devLogPath, 'utf8');
  startLines = content.split('\n').filter(line => line.trim()).length;
}
console.log(`Starting with ${startLines} lines in development.log\n`);

const browser = await chromium.launch({
  headless: false,
  slowMo: 300
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true
});

const page = await context.newPage();

try {
  // Test 1: Login
  console.log('1. Testing login...');
  await page.goto('https://localhost:3003/login');
  await page.waitForLoadState('domcontentloaded');
  
  // Check if we can see the login form
  const emailInput = await page.locator('input[type="email"]').isVisible();
  if (!emailInput) {
    console.log('❌ Login page not loaded properly');
    await page.screenshot({ path: 'screenshots/login-error.png' });
  } else {
    console.log('✓ Login page loaded');
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);
    
    console.log('✓ Login submitted');
    await page.waitForTimeout(2000);
    console.log(`  Current URL: ${page.url()}`);
  }
  
  // Test 2: Navigate to a few pages
  if (!page.url().includes('/login')) {
    console.log('\n2. Testing navigation...');
    
    // Finance
    await page.goto('https://localhost:3003/finance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('✓ Finance page loaded');
    
    // Cash Flow
    await page.goto('https://localhost:3003/cashflow');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log('✓ Cash Flow page loaded');
  }
  
  // Wait for logs to flush
  console.log('\n3. Waiting for logs to flush...');
  await page.waitForTimeout(3000);
  
} catch (error) {
  console.error('Test error:', error.message);
  await page.screenshot({ path: 'screenshots/test-error.png' });
} finally {
  await browser.close();
  
  // Check logs
  console.log('\n=== LOG CHECK ===');
  
  if (!fs.existsSync(devLogPath)) {
    console.log('❌ No development.log file found!');
  } else {
    const content = fs.readFileSync(devLogPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const newLines = lines.length - startLines;
    
    console.log(`Total lines: ${lines.length} (${newLines} new)`);
    
    // Check for duplicate patterns
    const messageMap = new Map();
    let duplicates = 0;
    
    lines.forEach((line, index) => {
      // Extract the message part (after the dash)
      const msgMatch = line.match(/\] - (.+)$/);
      if (msgMatch) {
        const msg = msgMatch[1];
        if (messageMap.has(msg)) {
          const prevIndex = messageMap.get(msg);
          // Check if they're consecutive or very close
          if (index - prevIndex <= 2) {
            duplicates++;
            console.log(`\nPossible duplicate at lines ${prevIndex + 1} and ${index + 1}:`);
            console.log(`  ${msg}`);
          }
        }
        messageMap.set(msg, index);
      }
    });
    
    if (duplicates === 0) {
      console.log('\n✅ No duplicate logs detected!');
    } else {
      console.log(`\n⚠️  Found ${duplicates} possible duplicates`);
    }
    
    // Show last 5 logs
    console.log('\nLast 5 logs:');
    lines.slice(-5).forEach(line => console.log(`  ${line}`));
  }
  
  console.log('\n✓ Test completed!');
}
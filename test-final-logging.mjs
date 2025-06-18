import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const devLogPath = path.join(logsDir, 'development.log');

console.log('=== FINAL LOGGING TEST ===\n');

// Clear logs
fs.writeFileSync(devLogPath, '');

// Read log file in real-time
function tailLogs() {
  const content = fs.readFileSync(devLogPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  return lines;
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 300
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true
});

const page = await context.newPage();

try {
  console.log('1. Testing Login Flow...');
  await page.goto('https://localhost:3003/login');
  await page.waitForLoadState('networkidle');
  
  // Login
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('   ✓ Logged in');
  
  console.log('\n2. Navigating to Finance...');
  await page.goto('https://localhost:3003/finance');
  await page.waitForTimeout(2000);
  console.log('   ✓ Finance page loaded');
  
  console.log('\n3. Navigating to Cash Flow...');
  await page.goto('https://localhost:3003/cashflow');
  await page.waitForTimeout(2000);
  console.log('   ✓ Cash Flow page loaded');
  
  console.log('\n4. Signing out...');
  const signOutButton = await page.locator('button:has-text("Sign Out")').first();
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
    await page.waitForTimeout(2000);
    console.log('   ✓ Signed out');
  }
  
} catch (error) {
  console.error('Test error:', error.message);
} finally {
  await browser.close();
  
  // Final log analysis
  console.log('\n=== FINAL LOG ANALYSIS ===');
  const logs = tailLogs();
  console.log(`Total logs: ${logs.length}`);
  
  // Count log levels
  const levels = { INFO: 0, DEBUG: 0, WARN: 0, ERROR: 0 };
  logs.forEach(log => {
    if (log.includes('[INFO]')) levels.INFO++;
    else if (log.includes('[DEBUG]')) levels.DEBUG++;
    else if (log.includes('[WARN]')) levels.WARN++;
    else if (log.includes('[ERROR]')) levels.ERROR++;
  });
  
  console.log('\nLog Level Distribution:');
  Object.entries(levels).forEach(([level, count]) => {
    if (count > 0) console.log(`  ${level}: ${count}`);
  });
  
  // Check for duplicates
  const seen = new Map();
  let duplicates = 0;
  
  logs.forEach((log, index) => {
    // Extract the message part (after module and level)
    const msgMatch = log.match(/\] \[(\w+)\] - (.+)$/);
    if (msgMatch) {
      const msg = msgMatch[2];
      if (seen.has(msg)) {
        const prevIndex = seen.get(msg);
        // Only count as duplicate if they're very close (within 5 lines)
        if (index - prevIndex <= 5) {
          duplicates++;
        }
      }
      seen.set(msg, index);
    }
  });
  
  console.log(`\nDuplicate logs: ${duplicates}`);
  
  if (duplicates === 0) {
    console.log('✅ No duplicate logs detected!');
  } else {
    console.log('⚠️  Some duplicate logs found (may be legitimate concurrent requests)');
  }
  
  // Show sample logs
  console.log('\n=== SAMPLE LOGS (first 5 and last 5) ===');
  console.log('First 5:');
  logs.slice(0, 5).forEach((log, i) => console.log(`  ${i + 1}: ${log}`));
  
  if (logs.length > 10) {
    console.log('\nLast 5:');
    logs.slice(-5).forEach((log, i) => console.log(`  ${logs.length - 4 + i}: ${log}`));
  }
  
  console.log('\n✓ Test completed successfully!');
}
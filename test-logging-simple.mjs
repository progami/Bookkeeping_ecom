import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const logsDir = path.join(process.cwd(), 'logs');
const devLogPath = path.join(logsDir, 'development.log');

console.log('=== SIMPLE LOGGING TEST ===\n');

// Clear the log file
fs.writeFileSync(devLogPath, '');
console.log('Cleared development.log\n');

const browser = await chromium.launch({
  headless: false,
  slowMo: 200
});

const context = await browser.newContext({
  ignoreHTTPSErrors: true
});

const page = await context.newPage();

// Collect console logs
const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push({
    type: msg.type(),
    text: msg.text(),
    time: new Date().toISOString()
  });
});

try {
  // Test 1: Navigate to homepage
  console.log('1. Navigate to homepage...');
  await page.goto('https://localhost:3003');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('   ✓ Homepage loaded');
  
  // Test 2: Navigate to login
  console.log('\n2. Navigate to login...');
  await page.goto('https://localhost:3003/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('   ✓ Login page loaded');
  
  // Test 3: Try to login
  console.log('\n3. Attempting login...');
  const emailInput = await page.locator('input[type="email"]').first();
  const passwordInput = await page.locator('input[type="password"]').first();
  const submitButton = await page.locator('button[type="submit"]').first();
  
  if (await emailInput.isVisible()) {
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    await submitButton.click();
    await page.waitForTimeout(3000);
    console.log('   ✓ Login submitted');
    console.log(`   Current URL: ${page.url()}`);
  } else {
    console.log('   ❌ Login form not found');
  }
  
  // Wait for logs to flush
  console.log('\n4. Waiting for logs to flush...');
  await page.waitForTimeout(2000);
  
} catch (error) {
  console.error('Test error:', error.message);
} finally {
  await browser.close();
  
  // Check logs
  console.log('\n=== LOG ANALYSIS ===');
  
  const content = fs.readFileSync(devLogPath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  console.log(`Total log lines: ${lines.length}`);
  
  // Check for duplicate patterns
  const duplicates = [];
  for (let i = 1; i < lines.length; i++) {
    const prevMsg = lines[i-1].replace(/^\[[^\]]+\]/, '').trim();
    const currMsg = lines[i].replace(/^\[[^\]]+\]/, '').trim();
    
    if (prevMsg === currMsg) {
      duplicates.push({ line: i + 1, message: currMsg });
    }
  }
  
  if (duplicates.length === 0) {
    console.log('\n✅ No duplicate logs detected!');
  } else {
    console.log(`\n❌ Found ${duplicates.length} duplicate logs:`);
    duplicates.forEach(dup => {
      console.log(`  Line ${dup.line}: ${dup.message.substring(0, 80)}...`);
    });
  }
  
  // Show all logs
  console.log('\n=== ALL LOGS ===');
  lines.forEach(line => console.log(line));
  
  // Show browser console
  console.log(`\n=== BROWSER CONSOLE (${consoleLogs.length} messages) ===`);
  if (consoleLogs.length > 0) {
    consoleLogs.forEach(log => {
      console.log(`[${log.type}] ${log.text.substring(0, 100)}${log.text.length > 100 ? '...' : ''}`);
    });
  }
  
  console.log('\n✓ Test completed!');
}
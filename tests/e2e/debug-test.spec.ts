import { test, expect } from '@playwright/test';

test.describe('Debug Test', () => {
  test('check what is on bookkeeping page', async ({ page }) => {
    // First check root
    await page.goto('https://localhost:3003/');
    console.log('Root page title:', await page.title());
    
    // Navigate to bookkeeping
    await page.goto('https://localhost:3003/bookkeeping');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot
    await page.screenshot({ path: 'bookkeeping-page.png', fullPage: true });
    
    // Log page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Log all headings
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Headings found:', headings);
    
    // Log all visible text
    const bodyText = await page.locator('body').textContent();
    console.log('Page contains:', bodyText?.substring(0, 500));
    
    // Check for any errors
    const errors = await page.locator('.error, [class*="error"]').count();
    console.log('Error elements found:', errors);
  });
  
  test('check API responses', async ({ page }) => {
    // Listen to API responses
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        console.log(`API: ${response.url()} - Status: ${response.status()}`);
      }
    });
    
    await page.goto('https://localhost:3003/bookkeeping');
    await page.waitForTimeout(3000); // Wait for API calls
  });
});
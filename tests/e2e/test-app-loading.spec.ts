import { test, expect } from '@playwright/test';

test.describe('App Loading Test', () => {
  test('should load the homepage successfully', async ({ page }) => {
    // Navigate to the app
    await page.goto('https://localhost:3003');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if the page title exists
    await expect(page).toHaveTitle(/Bookkeeping/i);
    
    // Check if the main heading is visible
    const mainHeading = page.locator('h1').first();
    await expect(mainHeading).toBeVisible();
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'homepage-test.png' });
    
    console.log('Homepage loaded successfully!');
  });
  
  test('should navigate to finance page', async ({ page }) => {
    // Navigate to the finance page directly
    await page.goto('https://localhost:3003/finance');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if Financial Overview heading exists
    const financeHeading = page.locator('h1:has-text("Financial Overview")');
    await expect(financeHeading).toBeVisible();
    
    // Check if the Xero connection status is visible (in the header area)
    const xeroStatus = page.locator('.flex.items-center.gap-2').filter({ hasText: /Connected to Xero|Connect to Xero/ }).first();
    await expect(xeroStatus).toBeVisible();
    
    // Check if the refresh button exists
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ path: 'finance-page-test.png' });
    
    console.log('Finance page loaded successfully!');
  });
});
import { test } from '@playwright/test';

test('take screenshot', async ({ page }) => {
  await page.goto('/bookkeeping');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'debug-dashboard.png', fullPage: true });
  
  // Count Connect Xero buttons
  const buttons = await page.getByRole('button', { name: /Connect Xero/i }).all();
  console.log(`Found ${buttons.length} buttons with "Connect Xero" text`);
  
  for (let i = 0; i < buttons.length; i++) {
    const buttonText = await buttons[i].textContent();
    const isVisible = await buttons[i].isVisible();
    console.log(`Button ${i + 1}: "${buttonText}" - Visible: ${isVisible}`);
  }
});
import { test, expect } from '@playwright/test';

test('basic navigation test', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  
  // Should redirect to bookkeeping
  await expect(page).toHaveURL('/bookkeeping');
  
  // Should show dashboard
  await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
});
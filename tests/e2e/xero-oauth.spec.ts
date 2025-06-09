import { test, expect } from '@playwright/test';

test.describe('Xero OAuth Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bookkeeping');
  });

  test('should show disconnected status when not authenticated', async ({ page }) => {
    // Check dashboard shows not connected
    await expect(page.getByText('Not Connected').first()).toBeVisible();
    
    // Check for connect button in system status
    await expect(page.getByRole('button', { name: 'Connect to Xero' })).toBeVisible();
  });

  test('should initiate OAuth flow when clicking connect', async ({ page, context }) => {
    // Click connect button
    await page.getByRole('button', { name: 'Connect to Xero' }).click();
    
    // Should redirect to Xero OAuth page
    const newPagePromise = context.waitForEvent('page');
    const newPage = await newPagePromise;
    
    await expect(newPage).toHaveURL(/login\.xero\.com/);
    
    // Should include proper OAuth parameters
    const url = new URL(newPage.url());
    expect(url.searchParams.get('client_id')).toBe('781184D1AD314CB6989EB8D2291AB453');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3003/api/v1/xero/auth/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toContain('accounting.transactions');
    expect(url.searchParams.get('scope')).toContain('accounting.settings');
    expect(url.searchParams.get('scope')).toContain('offline_access');
  });

  test('should handle OAuth callback and show connected status', async ({ page }) => {
    // Simulate successful OAuth callback
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    
    // Should redirect back to dashboard
    await page.waitForURL('/bookkeeping');
    
    // Should show connected status
    await expect(page.getByText('Connected').first()).toBeVisible();
    
    // Should show disconnect button
    await expect(page.getByRole('button', { name: /disconnect/i })).toBeVisible();
    
    // Should show organization name
    await expect(page.getByText(/organization:/i)).toBeVisible();
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // First connect
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    await page.waitForURL('/bookkeeping');
    
    // Refresh page
    await page.reload();
    
    // Should still show connected
    await expect(page.getByText('Connected').first()).toBeVisible();
  });

  test('should handle disconnect flow', async ({ page }) => {
    // First connect
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    await page.waitForURL('/bookkeeping');
    
    // Click disconnect
    await page.getByRole('button', { name: /disconnect/i }).click();
    
    // Confirm disconnect in dialog
    await page.getByRole('button', { name: /confirm.*disconnect/i }).click();
    
    // Should show disconnected status
    await expect(page.getByText('Not Connected').first()).toBeVisible();
    
    // Should show connect button again
    await expect(page.getByRole('button', { name: 'Connect to Xero' })).toBeVisible();
  });

  test('should handle OAuth errors gracefully', async ({ page }) => {
    // Simulate error callback
    await page.goto('/api/v1/xero/auth/callback?error=access_denied&error_description=User+denied+access');
    
    // Should redirect to dashboard with error
    await page.waitForURL('/bookkeeping');
    
    // Should show error message
    await expect(page.getByText(/failed to connect/i)).toBeVisible();
    
    // Should still show connect button
    await expect(page.getByRole('button', { name: 'Connect to Xero' })).toBeVisible();
  });

  test('should refresh token automatically when expired', async ({ page }) => {
    // Mock expired token scenario
    await page.route('/api/v1/xero/transactions', async route => {
      if (route.request().headers()['authorization']) {
        // First request returns 401
        await route.fulfill({
          status: 401,
          json: { error: 'Token expired' }
        });
      }
    });

    // Connect first
    await page.goto('/api/v1/xero/auth/callback?code=test_auth_code&state=test_state');
    await page.waitForURL('/bookkeeping');
    
    // Navigate to transactions page
    await page.goto('/bookkeeping/transactions');
    
    // Should still work after token refresh
    await expect(page.getByText('Transactions')).toBeVisible();
  });
});
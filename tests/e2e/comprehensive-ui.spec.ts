import { test, expect } from '@playwright/test';

test.describe('Comprehensive UI Tests', () => {
  test.describe('Dashboard Page', () => {
    test('should display all dashboard elements correctly', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Header
      await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
      await expect(page.getByText('Intelligent financial categorization and automation')).toBeVisible();
      
      // Header buttons (only one Connect Xero button should exist)
      const connectButtons = await page.getByRole('button', { name: 'Connect Xero', exact: true }).all();
      expect(connectButtons).toHaveLength(1); // Should only have one Connect Xero button
      
      await expect(page.getByRole('button', { name: 'Import SOPs' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export Report' })).toBeVisible();
      
      // Time range selector
      await expect(page.getByRole('combobox')).toBeVisible();
    });

    test('should display all stats cards', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Total Rules card
      const totalRulesCard = page.getByTestId('total-rules').locator('..');
      await expect(totalRulesCard).toBeVisible();
      await expect(totalRulesCard.getByText('Total')).toBeVisible();
      await expect(totalRulesCard.getByText('Categorization Rules')).toBeVisible();
      
      // Active Rules card
      const activeRulesCard = page.getByTestId('active-rules').locator('..');
      await expect(activeRulesCard).toBeVisible();
      await expect(activeRulesCard.getByText('Active', { exact: true }).first()).toBeVisible();
      await expect(activeRulesCard.getByText('Active Rules')).toBeVisible();
      
      // Inactive Rules card
      const inactiveRulesCard = page.getByTestId('inactive-rules').locator('..');
      await expect(inactiveRulesCard).toBeVisible();
      await expect(inactiveRulesCard.getByText('Inactive', { exact: true }).first()).toBeVisible();
      await expect(inactiveRulesCard.getByText('Inactive Rules')).toBeVisible();
      
      // Processed Transactions card
      await expect(page.getByText('This Month')).toBeVisible();
      await expect(page.getByText('Processed Transactions')).toBeVisible();
      await expect(page.getByText('No data yet')).toBeVisible();
    });

    test('should display quick actions section', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      const quickActions = page.getByTestId('quick-actions');
      await expect(quickActions).toBeVisible();
      await expect(quickActions.getByText('Quick Actions')).toBeVisible();
      
      // All action buttons
      await expect(quickActions.getByRole('button', { name: 'Create New Rule' })).toBeVisible();
      await expect(quickActions.getByRole('button', { name: 'View All Rules' })).toBeVisible();
      await expect(quickActions.getByRole('button', { name: 'Import Rules' })).toBeVisible();
      await expect(quickActions.getByRole('button', { name: 'Test Rules' })).toBeVisible();
      
      // Transaction button should not be visible when not connected
      const transactionButton = quickActions.getByRole('button', { name: 'View Transactions' });
      await expect(transactionButton).not.toBeVisible();
    });

    test('should display recent activity section', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      const recentActivity = page.getByTestId('recent-activity');
      await expect(recentActivity).toBeVisible();
      await expect(recentActivity.getByText('Recent Activity')).toBeVisible();
      
      // Should show empty state
      await expect(recentActivity.getByText('No recent activity')).toBeVisible();
    });

    test('should display system status section', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      const systemStatus = page.getByTestId('system-status');
      await expect(systemStatus).toBeVisible();
      await expect(systemStatus.getByText('System Status')).toBeVisible();
      
      // Xero Connection card
      await expect(systemStatus.getByText('Xero Connection')).toBeVisible();
      await expect(systemStatus.getByText('Not Connected')).toBeVisible();
      
      // Automation card
      await expect(systemStatus.getByText('Automation')).toBeVisible();
      await expect(systemStatus.getByText('Enabled')).toBeVisible();
      
      // Last Sync card
      await expect(systemStatus.getByText('Last Sync')).toBeVisible();
      await expect(systemStatus.getByText('Never')).toBeVisible();
    });
  });

  test.describe('Rules Page', () => {
    test('should display all rules page elements', async ({ page }) => {
      await page.goto('/bookkeeping/rules');
      
      // Header
      await expect(page.getByRole('heading', { name: 'Categorization Rules' })).toBeVisible();
      await expect(page.getByText('Manage your automated transaction categorization rules')).toBeVisible();
      
      // Action buttons
      await expect(page.getByRole('button', { name: 'Create New Rule' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
      
      // Search and filters
      await expect(page.getByPlaceholder('Search rules...')).toBeVisible();
      await expect(page.getByRole('combobox').first()).toBeVisible(); // Status filter
      await expect(page.getByRole('combobox').nth(1)).toBeVisible(); // Sort by
    });

    test('should display rules table structure', async ({ page }) => {
      await page.goto('/bookkeeping/rules');
      
      // Table headers
      await expect(page.getByRole('columnheader', { name: 'Rule' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Matching' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Target' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Priority' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });
  });

  test.describe('Create Rule Page', () => {
    test('should display all form elements', async ({ page }) => {
      await page.goto('/bookkeeping/rules/new');
      
      // Header
      await expect(page.getByRole('heading', { name: 'Create New Rule' })).toBeVisible();
      
      // Basic Information section
      await expect(page.getByText('Basic Information')).toBeVisible();
      await expect(page.getByLabel('Rule Name')).toBeVisible();
      await expect(page.getByLabel('Description')).toBeVisible();
      
      // Matching Criteria section
      await expect(page.getByText('Matching Criteria')).toBeVisible();
      await expect(page.getByLabel('Match Field')).toBeVisible();
      await expect(page.getByLabel('Match Type')).toBeVisible();
      await expect(page.getByLabel('Match Value')).toBeVisible();
      
      // Categorization Target section
      await expect(page.getByText('Categorization Target')).toBeVisible();
      await expect(page.getByLabel('Account Code')).toBeVisible();
      await expect(page.getByLabel('Tax Type')).toBeVisible();
      
      // Settings section
      await expect(page.getByText('Settings')).toBeVisible();
      await expect(page.getByLabel('Priority')).toBeVisible();
      await expect(page.getByLabel('Active')).toBeVisible();
      
      // Form buttons
      await expect(page.getByRole('button', { name: 'Test Rule' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Rule' })).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate between pages correctly', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Navigate to rules
      await page.getByRole('button', { name: 'View All Rules' }).click();
      await expect(page).toHaveURL('/bookkeeping/rules');
      
      // Navigate to create rule
      await page.getByRole('button', { name: 'Create New Rule' }).click();
      await expect(page).toHaveURL('/bookkeeping/rules/new');
      
      // Navigate back
      await page.getByRole('button', { name: 'Back to Rules' }).click();
      await expect(page).toHaveURL('/bookkeeping/rules');
      
      // Navigate to dashboard
      await page.getByRole('button', { name: 'Back to Dashboard' }).click();
      await expect(page).toHaveURL('/bookkeeping');
    });
  });

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/bookkeeping');
      
      // Check that main elements are still visible
      await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
      await expect(page.getByTestId('total-rules')).toBeVisible();
      await expect(page.getByTestId('quick-actions')).toBeVisible();
    });

    test('should be responsive on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/bookkeeping');
      
      // Check layout
      await expect(page.getByRole('heading', { name: 'Bookkeeping Dashboard' })).toBeVisible();
      const statsCards = page.locator('.grid > div').filter({ hasText: /Rules|Transactions/ });
      expect(await statsCards.count()).toBeGreaterThan(0);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Check for proper heading hierarchy
      const h1 = await page.getByRole('heading', { level: 1 }).count();
      expect(h1).toBe(1);
      
      // Check buttons have accessible names
      const buttons = await page.getByRole('button').all();
      for (const button of buttons) {
        const text = await button.textContent();
        expect(text).not.toBe('');
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(firstFocused).toBeTruthy();
      
      // Continue tabbing
      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
      expect(secondFocused).toBeTruthy();
    });
  });

  test.describe('Theme and Styling', () => {
    test('should have consistent dark theme', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Check background colors
      const body = page.locator('body');
      await expect(body).toHaveCSS('background-color', 'rgb(2, 8, 23)'); // Updated to actual color
      
      // Check text is light colored for dark theme
      const heading = page.getByRole('heading', { name: 'Bookkeeping Dashboard' });
      await expect(heading).toHaveCSS('color', 'rgb(255, 255, 255)');
    });

    test('should have gradient effects', async ({ page }) => {
      await page.goto('/bookkeeping');
      
      // Check for gradient backgrounds
      const gradientElements = page.locator('[class*="gradient"]');
      expect(await gradientElements.count()).toBeGreaterThan(0);
    });
  });
});
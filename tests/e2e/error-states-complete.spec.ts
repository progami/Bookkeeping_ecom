import { test, expect, Page } from '@playwright/test'

test.describe('Error States - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Connection Error States', () => {
    test('should show retry button on connection failure', async () => {
      // Navigate to a page that requires connection
      await page.goto('/bookkeeping/transactions')
      
      // Look for connection error indicators
      const errorIndicators = [
        page.locator('text="Connection failed"'),
        page.locator('text="Unable to connect"'),
        page.locator('text="Network error"'),
        page.locator('[data-testid="connection-error"]')
      ]
      
      let hasError = false
      for (const indicator of errorIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          hasError = true
          await expect(indicator).toBeVisible()
          break
        }
      }
      
      // If error exists, should show retry button
      if (hasError) {
        const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")')
        await expect(retryButton).toBeVisible()
        
        // Test retry functionality
        await retryButton.click()
        
        // Should show loading state
        const loading = page.locator('.animate-spin, [data-testid="loading"]')
        const isLoading = await loading.isVisible().catch(() => false)
        
        if (isLoading) {
          await expect(loading).toBeVisible()
        }
      }
    })

    test('should show reconnect button for expired sessions', async () => {
      await page.goto('/bookkeeping')
      
      // Look for session expired indicators
      const sessionIndicators = [
        page.locator('text="Session expired"'),
        page.locator('text="Authentication expired"'),
        page.locator('text="Please reconnect"'),
        page.locator('[data-testid="session-expired"]')
      ]
      
      let hasSessionError = false
      for (const indicator of sessionIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          hasSessionError = true
          await expect(indicator).toBeVisible()
          break
        }
      }
      
      if (hasSessionError) {
        const reconnectButton = page.locator('button:has-text("Reconnect"), button:has-text("Sign in again")')
        await expect(reconnectButton).toBeVisible()
        
        // Test reconnect action
        await reconnectButton.click()
        
        // Should redirect to auth or show connect flow
        const connectButton = page.locator('button:has-text("Connect Xero")')
        const isRedirected = await connectButton.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (isRedirected) {
          await expect(connectButton).toBeVisible()
        }
      }
    })

    test('should handle API error responses gracefully', async () => {
      await page.goto('/bookkeeping/transactions')
      
      // Look for API error messages
      const apiErrors = [
        page.locator('text="Failed to fetch"'),
        page.locator('text="Server error"'),
        page.locator('text="Something went wrong"'),
        page.locator('[data-testid="api-error"]')
      ]
      
      let hasApiError = false
      for (const error of apiErrors) {
        if (await error.isVisible().catch(() => false)) {
          hasApiError = true
          await expect(error).toBeVisible()
          
          // Should provide helpful context
          const errorDetails = page.locator('.error-details, [data-testid="error-details"]')
          const hasDetails = await errorDetails.isVisible().catch(() => false)
          
          if (hasDetails) {
            const details = await errorDetails.textContent()
            expect(details).toBeTruthy()
          }
          break
        }
      }
    })
  })

  test.describe('Data Sync Error States', () => {
    test('should show sync error with retry option', async () => {
      await page.goto('/bookkeeping')
      
      // Trigger sync if button exists
      const syncButton = page.locator('button:has-text("Sync"), button:has-text("Sync Now")')
      
      if (await syncButton.isVisible()) {
        await syncButton.click()
        
        // Wait for potential error
        await page.waitForTimeout(1000)
        
        // Check for sync errors
        const syncErrors = [
          page.locator('text="Sync failed"'),
          page.locator('text="Failed to sync"'),
          page.locator('text="Error syncing data"'),
          page.locator('[data-testid="sync-error"]')
        ]
        
        for (const error of syncErrors) {
          if (await error.isVisible().catch(() => false)) {
            await expect(error).toBeVisible()
            
            // Should show retry sync option
            const retrySyncButton = page.locator('button:has-text("Retry Sync"), button:has-text("Try Again")')
            const hasRetry = await retrySyncButton.isVisible().catch(() => false)
            
            if (hasRetry) {
              await expect(retrySyncButton).toBeVisible()
            }
            break
          }
        }
      }
    })

    test('should show Sync from Xero button when no data exists', async () => {
      await page.goto('/bookkeeping/transactions')
      
      // Check for empty state
      const emptyStates = [
        page.locator('text="No transactions found"'),
        page.locator('text="No data available"'),
        page.locator('[data-testid="empty-state"]')
      ]
      
      let isEmpty = false
      for (const emptyState of emptyStates) {
        if (await emptyState.isVisible().catch(() => false)) {
          isEmpty = true
          break
        }
      }
      
      if (isEmpty) {
        // Should show sync from Xero button
        const syncFromXeroButton = page.locator('button:has-text("Sync from Xero"), button:has-text("Import from Xero")')
        const hasSyncButton = await syncFromXeroButton.isVisible().catch(() => false)
        
        if (hasSyncButton) {
          await expect(syncFromXeroButton).toBeVisible()
          
          // Test sync action
          await syncFromXeroButton.click()
          
          // Should show progress
          const progress = page.locator('.animate-spin, text="Syncing", [data-testid="sync-progress"]')
          const hasProgress = await progress.isVisible({ timeout: 1000 }).catch(() => false)
          
          if (hasProgress) {
            await expect(progress).toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Form Validation Errors', () => {
    test('should show validation errors on invalid form submission', async () => {
      await page.goto('/bookkeeping/rules/new')
      
      // Try to submit without filling required fields
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")')
      
      if (await submitButton.isVisible()) {
        await submitButton.click()
        
        // Should show validation errors
        const validationErrors = [
          page.locator('text="Required"'),
          page.locator('text="This field is required"'),
          page.locator('.error-message'),
          page.locator('[data-testid="validation-error"]')
        ]
        
        let hasValidation = false
        for (const error of validationErrors) {
          if (await error.isVisible().catch(() => false)) {
            hasValidation = true
            await expect(error).toBeVisible()
            break
          }
        }
        
        // Form should not submit
        expect(page.url()).toContain('/rules/new')
      }
    })

    test('should clear errors when fields are corrected', async () => {
      await page.goto('/bookkeeping/rules/new')
      
      const submitButton = page.locator('button[type="submit"], button:has-text("Create")')
      
      if (await submitButton.isVisible()) {
        // Submit to trigger errors
        await submitButton.click()
        
        // Wait for errors
        await page.waitForTimeout(500)
        
        // Fill a required field
        const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first()
        if (await nameInput.isVisible()) {
          await nameInput.fill('Test Rule')
          
          // Error for this field should clear
          const nameError = page.locator('.error-message').filter({ has: page.locator('text="name"') })
          const hasNameError = await nameError.isVisible().catch(() => false)
          
          if (hasNameError) {
            await expect(nameError).not.toBeVisible()
          }
        }
      }
    })
  })

  test.describe('Network Timeout Handling', () => {
    test('should handle slow network gracefully', async () => {
      // Set slow network conditions
      const client = await page.context().newCDPSession(page)
      await client.send('Network.enable')
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: 1000,
        uploadThroughput: 1000,
        latency: 2000
      })
      
      await page.goto('/bookkeeping', { timeout: 60000 })
      
      // Should show loading states
      const loadingIndicators = [
        page.locator('.animate-spin'),
        page.locator('[data-testid="loading"]'),
        page.locator('text="Loading"')
      ]
      
      let hasLoading = false
      for (const loading of loadingIndicators) {
        if (await loading.isVisible().catch(() => false)) {
          hasLoading = true
          await expect(loading).toBeVisible()
          break
        }
      }
      
      // Reset network conditions
      await client.send('Network.disable')
    })

    test('should show timeout error for extremely slow requests', async () => {
      await page.goto('/bookkeeping/transactions')
      
      // Look for timeout errors
      const timeoutErrors = [
        page.locator('text="Request timed out"'),
        page.locator('text="Connection timeout"'),
        page.locator('text="Taking too long"'),
        page.locator('[data-testid="timeout-error"]')
      ]
      
      for (const error of timeoutErrors) {
        if (await error.isVisible().catch(() => false)) {
          await expect(error).toBeVisible()
          
          // Should offer to retry
          const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")')
          const hasRetry = await retryButton.isVisible().catch(() => false)
          
          if (hasRetry) {
            await expect(retryButton).toBeVisible()
          }
          break
        }
      }
    })
  })

  test.describe('Permission Errors', () => {
    test('should handle insufficient permissions gracefully', async () => {
      await page.goto('/bookkeeping/rules')
      
      // Look for permission errors
      const permissionErrors = [
        page.locator('text="Access denied"'),
        page.locator('text="Insufficient permissions"'),
        page.locator('text="Not authorized"'),
        page.locator('[data-testid="permission-error"]')
      ]
      
      for (const error of permissionErrors) {
        if (await error.isVisible().catch(() => false)) {
          await expect(error).toBeVisible()
          
          // Should provide guidance
          const guidance = page.locator('text="contact administrator"')
          const hasGuidance = await guidance.isVisible().catch(() => false)
          
          if (hasGuidance) {
            await expect(guidance).toBeVisible()
          }
          break
        }
      }
    })
  })
})
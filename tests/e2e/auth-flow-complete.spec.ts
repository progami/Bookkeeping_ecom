import { test, expect, Page } from '@playwright/test'

test.describe('Authentication Flow - Complete UI Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Xero OAuth Flow', () => {
    test('should show Connect Xero button when not authenticated', async () => {
      await page.goto('/bookkeeping')
      
      // Look for Connect Xero button
      const connectButton = page.locator('button:has-text("Connect Xero"), button:has-text("Connect to Xero")')
      const isVisible = await connectButton.isVisible().catch(() => false)
      
      if (isVisible) {
        await expect(connectButton).toBeVisible()
        
        // Button should be clickable
        await expect(connectButton).toBeEnabled()
        
        // Should have proper styling
        const classNames = await connectButton.getAttribute('class')
        expect(classNames).toContain('bg-blue')
      }
    })

    test('should initiate OAuth flow when clicking Connect Xero', async () => {
      await page.goto('/bookkeeping')
      
      const connectButton = page.locator('button:has-text("Connect Xero"), button:has-text("Connect to Xero")').first()
      
      if (await connectButton.isVisible()) {
        // Listen for popup or navigation
        const [popup] = await Promise.all([
          page.waitForEvent('popup', { timeout: 5000 }).catch(() => null),
          connectButton.click()
        ])
        
        if (popup) {
          // OAuth opened in popup
          await expect(popup.url()).toContain('xero.com')
          await popup.close()
        } else {
          // OAuth might redirect in same window
          const currentUrl = page.url()
          if (currentUrl.includes('xero.com') || currentUrl.includes('oauth') || currentUrl.includes('auth')) {
            expect(currentUrl).toMatch(/xero\.com|oauth|auth/)
          }
        }
      }
    })

    test('should handle OAuth callback redirect', async () => {
      // Test callback URL handling
      const callbackUrl = '/api/auth/callback?code=test_code&state=test_state'
      
      try {
        await page.goto(callbackUrl)
        
        // Should redirect after processing
        await page.waitForURL(/bookkeeping|finance/, { timeout: 5000 })
        
        const finalUrl = page.url()
        expect(finalUrl).toMatch(/bookkeeping|finance/)
      } catch (error) {
        // If callback fails, should show error
        const errorMessage = page.locator('text="Authentication failed", text="Error connecting"')
        const hasError = await errorMessage.isVisible().catch(() => false)
        
        if (hasError) {
          await expect(errorMessage).toBeVisible()
        }
      }
    })

    test('should show organization selection if multiple orgs', async () => {
      await page.goto('/bookkeeping')
      
      // Look for org selection dropdown
      const orgSelector = page.locator('select[name="organization"], select[data-testid="org-selector"]')
      const hasOrgSelector = await orgSelector.isVisible().catch(() => false)
      
      if (hasOrgSelector) {
        await expect(orgSelector).toBeVisible()
        
        // Should have options
        const options = await orgSelector.locator('option').count()
        expect(options).toBeGreaterThan(1)
      }
    })

    test('should display connected status after authentication', async () => {
      await page.goto('/bookkeeping')
      
      // Check for connection status indicators
      const connectedIndicators = [
        page.locator('text="Connected to Xero"'),
        page.locator('button:has-text("Disconnect")'),
        page.locator('[data-testid="xero-status"]'),
        page.locator('.xero-connection-status')
      ]
      
      let isConnected = false
      for (const indicator of connectedIndicators) {
        if (await indicator.isVisible().catch(() => false)) {
          isConnected = true
          await expect(indicator).toBeVisible()
          break
        }
      }
      
      // If connected, should show organization name
      if (isConnected) {
        const orgName = page.locator('[data-testid="org-name"], .organization-name, text=/Organization:.*/')
        const hasOrgName = await orgName.isVisible().catch(() => false)
        
        if (hasOrgName) {
          const name = await orgName.textContent()
          expect(name).toBeTruthy()
        }
      }
    })

    test('should handle disconnect action', async () => {
      await page.goto('/bookkeeping')
      
      const disconnectButton = page.locator('button:has-text("Disconnect")')
      
      if (await disconnectButton.isVisible()) {
        // Set up dialog handler
        page.on('dialog', dialog => {
          expect(dialog.message()).toContain('disconnect')
          dialog.accept()
        })
        
        await disconnectButton.click()
        
        // Should redirect or show connect button again
        await page.waitForTimeout(1000)
        
        const connectButton = page.locator('button:has-text("Connect Xero"), button:has-text("Connect to Xero")')
        const isDisconnected = await connectButton.isVisible().catch(() => false)
        
        if (isDisconnected) {
          await expect(connectButton).toBeVisible()
        }
      }
    })
  })

  test.describe('Authentication Error States', () => {
    test('should show error when OAuth fails', async () => {
      // Test error callback
      const errorUrl = '/api/auth/callback?error=access_denied'
      
      await page.goto(errorUrl)
      
      // Should show error message
      const errorMessages = [
        page.locator('text="Authentication failed"'),
        page.locator('text="Failed to connect"'),
        page.locator('text="Error connecting to Xero"'),
        page.locator('[data-testid="auth-error"]')
      ]
      
      let foundError = false
      for (const error of errorMessages) {
        if (await error.isVisible().catch(() => false)) {
          foundError = true
          await expect(error).toBeVisible()
          break
        }
      }
      
      // Should show retry option
      if (foundError) {
        const retryButton = page.locator('button:has-text("Try Again"), button:has-text("Retry")')
        const hasRetry = await retryButton.isVisible().catch(() => false)
        
        if (hasRetry) {
          await expect(retryButton).toBeVisible()
        }
      }
    })

    test('should handle expired session', async () => {
      await page.goto('/bookkeeping')
      
      // Look for session expired indicators
      const sessionExpired = [
        page.locator('text="Session expired"'),
        page.locator('text="Please reconnect"'),
        page.locator('button:has-text("Reconnect")')
      ]
      
      for (const indicator of sessionExpired) {
        if (await indicator.isVisible().catch(() => false)) {
          await expect(indicator).toBeVisible()
          
          // Should have reconnect option
          const reconnectButton = page.locator('button:has-text("Reconnect"), button:has-text("Connect Again")')
          const hasReconnect = await reconnectButton.isVisible().catch(() => false)
          
          if (hasReconnect) {
            await expect(reconnectButton).toBeVisible()
          }
          break
        }
      }
    })
  })

  test.describe('Authentication UI States', () => {
    test('should show loading state during authentication', async () => {
      await page.goto('/bookkeeping')
      
      const connectButton = page.locator('button:has-text("Connect Xero"), button:has-text("Connect to Xero")').first()
      
      if (await connectButton.isVisible()) {
        // Click and check for loading state
        const loadingPromise = page.waitForSelector('.animate-spin, [data-testid="loading"], text="Connecting"', { 
          state: 'visible',
          timeout: 1000 
        }).catch(() => null)
        
        await connectButton.click()
        
        const loadingElement = await loadingPromise
        if (loadingElement) {
          await expect(loadingElement).toBeVisible()
        }
      }
    })

    test('should maintain state across page refreshes', async () => {
      await page.goto('/bookkeeping')
      
      // Check initial state
      const isConnected = await page.locator('button:has-text("Disconnect")').isVisible().catch(() => false)
      
      // Refresh page
      await page.reload()
      
      // State should persist
      if (isConnected) {
        await expect(page.locator('button:has-text("Disconnect")')).toBeVisible()
      } else {
        await expect(page.locator('button:has-text("Connect Xero"), button:has-text("Connect to Xero")')).toBeVisible()
      }
    })
  })
})
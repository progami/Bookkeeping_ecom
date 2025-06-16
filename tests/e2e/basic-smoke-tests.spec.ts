import { test, expect } from '@playwright/test'

// Pages to test
const pages = [
  { path: '/', name: 'Home', requiresAuth: false },
  { path: '/finance', name: 'Finance', requiresAuth: true },
  { path: '/bookkeeping', name: 'Bookkeeping', requiresAuth: true },
  { path: '/bookkeeping/transactions', name: 'Transactions', requiresAuth: true },
  { path: '/analytics', name: 'Analytics', requiresAuth: true },
  { path: '/cashflow', name: 'Cash Flow', requiresAuth: true },
]

test.describe('Basic Smoke Tests - Every Page Should Work', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/')
  })

  pages.forEach(({ path, name, requiresAuth }) => {
    test.describe(`${name} Page (${path})`, () => {
      test('should load without errors', async ({ page }) => {
        // Navigate directly to the page
        const response = await page.goto(path)
        
        // Page should load successfully
        expect(response?.status()).toBeLessThan(400)
        
        // No console errors
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') {
            errors.push(msg.text())
          }
        })
        
        await page.waitForTimeout(1000)
        
        // Filter out expected errors (like CSP from external sites)
        const realErrors = errors.filter(e => 
          !e.includes('Content Security Policy') &&
          !e.includes('dna-analytics.xero.com')
        )
        
        expect(realErrors).toHaveLength(0)
      })

      test('should check auth status on page load', async ({ page }) => {
        // Listen for auth check API call
        let authCheckCalled = false
        page.on('request', request => {
          if (request.url().includes('/api/v1/xero/status')) {
            authCheckCalled = true
          }
        })
        
        // Navigate to page
        await page.goto(path)
        
        // Wait for auth check
        await page.waitForTimeout(2000)
        
        // Auth pages should check auth status
        if (requiresAuth) {
          expect(authCheckCalled).toBe(true)
        }
      })

      test('should display correct UI when not authenticated', async ({ page }) => {
        // Ensure we're not authenticated by making a POST request
        await page.evaluate(async () => {
          await fetch('/api/v1/xero/disconnect', { method: 'POST' })
        })
        
        // Navigate to page
        await page.goto(path)
        await page.waitForTimeout(2000)
        
        if (requiresAuth) {
          // Should show connect prompt
          const connectButton = await page.locator('text=Connect to Xero').count()
          expect(connectButton).toBeGreaterThan(0)
          
          // Should not show loading skeleton forever
          const skeletons = await page.locator('[class*="skeleton"]').count()
          expect(skeletons).toBe(0)
        }
      })

      test('should handle direct URL access (cold start)', async ({ context }) => {
        // Create new page (simulates new tab/window)
        const newPage = await context.newPage()
        
        // Navigate directly without any prior navigation
        const response = await newPage.goto(path)
        expect(response?.status()).toBeLessThan(400)
        
        // Wait for page to stabilize
        await newPage.waitForTimeout(2000)
        
        if (requiresAuth) {
          // Should either show content or connect prompt, not error
          const hasContent = await newPage.locator('main').count() > 0
          const hasConnectPrompt = await newPage.locator('text=Connect to Xero').count() > 0
          
          expect(hasContent || hasConnectPrompt).toBe(true)
        }
        
        await newPage.close()
      })

      test('should handle browser refresh correctly', async ({ page }) => {
        // Navigate to page
        await page.goto(path)
        await page.waitForTimeout(1000)
        
        // Refresh the page
        await page.reload()
        await page.waitForTimeout(2000)
        
        // Page should still work after refresh
        const response = await page.evaluate(() => document.readyState)
        expect(response).toBe('complete')
        
        // No error messages
        const errorText = await page.locator('text=/error|Error|ERROR/i').count()
        expect(errorText).toBe(0)
      })

      test('should have correct page title and heading', async ({ page }) => {
        await page.goto(path)
        await page.waitForTimeout(1000)
        
        // Check title exists
        const title = await page.title()
        expect(title).toBeTruthy()
        
        // Check main heading exists
        const heading = await page.locator('h1').first()
        const headingText = await heading.textContent()
        expect(headingText).toBeTruthy()
      })
    })
  })

  test('Auth state should persist across pages', async ({ page }) => {
    // Disconnect first
    await page.evaluate(async () => {
      await fetch('/api/v1/xero/disconnect', { method: 'POST' })
    })
    
    // Check multiple pages show consistent auth state
    for (const { path, requiresAuth } of pages.filter(p => p.requiresAuth)) {
      await page.goto(path)
      await page.waitForTimeout(1000)
      
      const connectPrompt = await page.locator('text=Connect to Xero').count()
      expect(connectPrompt).toBeGreaterThan(0)
    }
  })

  test('Navigation should work from any page', async ({ page }) => {
    for (const { path } of pages) {
      await page.goto(path)
      
      // Should have navigation elements
      const nav = await page.locator('nav').count()
      expect(nav).toBeGreaterThan(0)
    }
  })
})
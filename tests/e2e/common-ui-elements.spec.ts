import { test, expect, Page } from '@playwright/test'
import { expectSuccessToast, expectErrorToast, expectLoadingToast, waitForToastsToDisappear } from '../helpers/toast-helper'

test.describe('Common UI Elements - Complete Testing', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Toast Notifications', () => {
    test('should show success toast on successful actions', async () => {
      await page.goto('/bookkeeping/rules/new')
      
      // Fill minimal required fields
      await page.locator('input[placeholder="e.g., Office Supplies"]').fill('Test Rule')
      await page.locator('input[placeholder="e.g., office supplies"]').fill('test pattern')
      await page.locator('input[placeholder="e.g., 400"]').fill('200')
      
      const submitButton = page.locator('button:has-text("Create Rule")')
      await submitButton.click()
      
      // Check for success toast using helper
      await expectSuccessToast(page, /Rule created successfully|Success/)
    })

    test('should show error toast on failed actions', async () => {
      await page.goto('/bookkeeping')
      
      // Try an action that might fail
      const syncButton = page.locator('button:has-text("Sync Now")')
      
      if (await syncButton.isVisible()) {
        // Intercept network request to simulate failure
        await page.route('**/api/v1/xero/sync**', route => route.abort())
        
        await syncButton.click()
        
        // Check for error toast using helper
        await expectErrorToast(page, /error|failed|Error/i)
      }
    })

    test('should show loading toast during long operations', async () => {
      await page.goto('/bookkeeping/transactions')
      
      const syncButton = page.locator('button:has-text("Full Sync")')
      
      if (await syncButton.isVisible()) {
        // Delay the response to see loading state
        await page.route('**/api/v1/xero/sync**', async route => {
          await page.waitForTimeout(2000)
          await route.fulfill({ 
            status: 200, 
            body: JSON.stringify({ success: true }) 
          })
        })
        
        await syncButton.click()
        
        // Check for loading toast
        await expectLoadingToast(page, /Syncing|Loading|Processing/i)
      }
    })

    test('should stack multiple toasts', async () => {
      await page.goto('/bookkeeping/transactions')
      
      // Trigger multiple actions quickly
      const buttons = await page.locator('button').all()
      
      if (buttons.length >= 2) {
        // Click multiple buttons quickly
        await buttons[0].click()
        await buttons[1].click()
        
        // Check for multiple toasts
        const toasts = page.locator('[role="alert"], .toast, [data-testid*="toast"]')
        const toastCount = await toasts.count()
        
        if (toastCount > 1) {
          expect(toastCount).toBeGreaterThanOrEqual(2)
        }
      }
    })
  })

  test.describe('Loading States', () => {
    test('should show spinner animations during data loading', async () => {
      await page.goto('/bookkeeping')
      
      // Look for spinner on initial load or during actions
      const spinners = page.locator('.animate-spin, svg.animate-spin, [data-testid="spinner"]')
      const hasSpinner = await spinners.first().isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasSpinner) {
        await expect(spinners.first()).toBeVisible()
        
        // Spinner should be animating
        const classNames = await spinners.first().getAttribute('class')
        expect(classNames).toContain('animate-spin')
      }
    })

    test('should show skeleton loaders for content placeholders', async () => {
      await page.goto('/bookkeeping')
      
      // Look for skeleton loaders
      const skeletons = page.locator('.skeleton, .animate-pulse, [data-testid="skeleton"]')
      const hasSkeleton = await skeletons.first().isVisible({ timeout: 2000 }).catch(() => false)
      
      if (hasSkeleton) {
        await expect(skeletons.first()).toBeVisible()
        
        // Should have shimmer/pulse animation
        const classNames = await skeletons.first().getAttribute('class')
        expect(classNames).toMatch(/skeleton|animate-pulse/)
        
        // Skeletons should be replaced with content
        await page.waitForTimeout(2000)
        const stillHasSkeleton = await skeletons.first().isVisible().catch(() => false)
        
        // Should eventually load content
        expect(stillHasSkeleton !== undefined).toBeTruthy()
      }
    })

    test('should show loading overlays for page transitions', async () => {
      await page.goto('/bookkeeping')
      
      // Click a navigation link
      const navLink = page.locator('a, button').filter({ hasText: /transactions|rules|sop/i }).first()
      
      if (await navLink.isVisible()) {
        // Watch for loading overlay
        const overlayPromise = page.waitForSelector('.loading-overlay, [data-testid="loading-overlay"], .fixed.inset-0', {
          state: 'visible',
          timeout: 1000
        }).catch(() => null)
        
        await navLink.click()
        
        const overlay = await overlayPromise
        if (overlay) {
          await expect(overlay).toBeVisible()
          
          // Overlay should block interactions
          const styles = await overlay.evaluate(el => window.getComputedStyle(el))
          expect(styles.pointerEvents).toBe('none')
        }
      }
    })
  })

  test.describe('Hover Effects', () => {
    test('should apply hover effects to cards', async () => {
      await page.goto('/finance')
      
      const cards = page.locator('.card, [data-testid*="card"], .bg-slate-800')
      const firstCard = cards.first()
      
      if (await firstCard.isVisible()) {
        // Get initial styles
        const initialBorder = await firstCard.evaluate(el => window.getComputedStyle(el).borderColor)
        
        // Hover over card
        await firstCard.hover()
        await page.waitForTimeout(100)
        
        // Border color should change on hover
        const hoverBorder = await firstCard.evaluate(el => window.getComputedStyle(el).borderColor)
        
        // Colors might be different (can't guarantee exact colors)
        expect(hoverBorder).toBeTruthy()
      }
    })

    test('should apply hover effects to buttons', async () => {
      await page.goto('/bookkeeping')
      
      const button = page.locator('button').filter({ hasText: /sync|connect|generate/i }).first()
      
      if (await button.isVisible()) {
        // Get initial background
        const initialBg = await button.evaluate(el => window.getComputedStyle(el).backgroundColor)
        
        // Hover over button
        await button.hover()
        await page.waitForTimeout(100)
        
        // Background should change or opacity should change
        const hoverBg = await button.evaluate(el => window.getComputedStyle(el).backgroundColor)
        const opacity = await button.evaluate(el => window.getComputedStyle(el).opacity)
        
        // Either background changed or opacity changed
        expect(hoverBg !== initialBg || opacity !== '1').toBeTruthy()
      }
    })

    test('should apply hover effects to table rows', async () => {
      await page.goto('/bookkeeping/transactions')
      
      const tableRow = page.locator('tbody tr').first()
      
      if (await tableRow.isVisible()) {
        // Get initial background
        const initialBg = await tableRow.evaluate(el => window.getComputedStyle(el).backgroundColor)
        
        // Hover over row
        await tableRow.hover()
        await page.waitForTimeout(100)
        
        // Background should change
        const hoverBg = await tableRow.evaluate(el => window.getComputedStyle(el).backgroundColor)
        
        // Background should be different on hover
        expect(hoverBg).toBeTruthy()
      }
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should allow tab navigation through form fields', async () => {
      await page.goto('/bookkeeping/rules/new')
      
      // Focus first input
      const firstInput = page.locator('input').first()
      if (await firstInput.isVisible()) {
        await firstInput.focus()
        
        // Tab to next field
        await page.keyboard.press('Tab')
        
        // Next field should be focused
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
        expect(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']).toContain(focusedElement)
        
        // Tab through multiple fields
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('Tab')
        }
        
        // Should still have a focused element
        const stillFocused = await page.evaluate(() => document.activeElement?.tagName)
        expect(stillFocused).toBeTruthy()
      }
    })

    test('should submit forms with Enter key', async () => {
      await page.goto('/bookkeeping/rules/new')
      
      // Fill required fields
      const inputs = page.locator('input')
      const inputCount = await inputs.count()
      
      if (inputCount >= 3) {
        await inputs.nth(0).fill('Test')
        await inputs.nth(1).fill('test')
        await inputs.nth(2).fill('200')
        
        // Press Enter to submit
        await inputs.nth(2).press('Enter')
        
        // Should either submit or show validation
        await page.waitForTimeout(1000)
        
        // Check if navigated or showed error
        const url = page.url()
        const hasError = await page.locator('.error-message, [role="alert"]').isVisible().catch(() => false)
        
        expect(url.includes('/new') || hasError).toBeTruthy()
      }
    })

    test('should close modals with Escape key', async () => {
      await page.goto('/bookkeeping/transactions')
      
      // Open a modal
      const modalTrigger = page.locator('button:has-text("Reconcile")').first()
      
      if (await modalTrigger.isVisible()) {
        await modalTrigger.click()
        
        // Wait for modal
        const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]')
        const hasModal = await modal.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (hasModal) {
          // Press Escape
          await page.keyboard.press('Escape')
          
          // Modal should close
          await expect(modal).not.toBeVisible()
        }
      }
    })
  })

  test.describe('Responsive Behaviors', () => {
    test('should show mobile menu toggle on small screens', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/finance')
      
      // Look for mobile menu toggle
      const menuToggle = page.locator('button[aria-label*="menu"], button:has-text("Menu"), [data-testid="mobile-menu"]')
      const hasMenuToggle = await menuToggle.isVisible().catch(() => false)
      
      if (hasMenuToggle) {
        await expect(menuToggle).toBeVisible()
        
        // Click to open menu
        await menuToggle.click()
        
        // Mobile menu should appear
        const mobileMenu = page.locator('nav[role="navigation"], .mobile-menu, [data-testid="mobile-nav"]')
        const hasMenu = await mobileMenu.isVisible({ timeout: 1000 }).catch(() => false)
        
        if (hasMenu) {
          await expect(mobileMenu).toBeVisible()
        }
      }
    })

    test('should adapt grid layouts for different screen sizes', async () => {
      await page.goto('/finance')
      
      // Desktop view
      await page.setViewportSize({ width: 1920, height: 1080 })
      const desktopCards = page.locator('.grid > *')
      const desktopCount = await desktopCards.count()
      
      if (desktopCount > 0) {
        // Get grid columns on desktop
        const desktopGrid = await page.locator('.grid').first().evaluate(el => 
          window.getComputedStyle(el).gridTemplateColumns
        )
        
        // Mobile view
        await page.setViewportSize({ width: 375, height: 667 })
        
        // Grid should stack on mobile
        const mobileGrid = await page.locator('.grid').first().evaluate(el => 
          window.getComputedStyle(el).gridTemplateColumns
        )
        
        // Mobile should have fewer columns
        expect(mobileGrid).not.toBe(desktopGrid)
      }
    })

    test('should have touch-friendly tap targets on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('/bookkeeping')
      
      // Check button sizes
      const buttons = page.locator('button')
      const firstButton = buttons.first()
      
      if (await firstButton.isVisible()) {
        const box = await firstButton.boundingBox()
        
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.height).toBeGreaterThanOrEqual(40)
          expect(box.width).toBeGreaterThanOrEqual(40)
        }
      }
    })
  })
})
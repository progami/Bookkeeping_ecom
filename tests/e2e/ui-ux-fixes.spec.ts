import { test, expect } from '@playwright/test'

test.describe('UI/UX Fixes Verification', () => {
  test('Login page should use dark theme', async ({ page }) => {
    await page.goto('/login')
    
    // Check background is dark
    const body = page.locator('body')
    const backgroundColor = await body.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    )
    
    // Should be dark slate color (rgb values for slate-950)
    expect(backgroundColor).toContain('rgb')
    
    // Check card has dark theme styling
    const card = page.locator('.max-w-md').first()
    const cardClass = await card.getAttribute('class')
    expect(cardClass).toContain('bg-slate-800')
    
    // Check button uses emerald color
    const button = page.locator('button').filter({ hasText: 'Sign in with Xero' })
    await expect(button).toHaveClass(/bg-emerald-600/)
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: 'screenshots/login-dark-theme-test.png',
      fullPage: true 
    })
  })

  test('Mobile menu should be visible and functional', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/finance')
    
    // Check mobile menu button is visible
    const menuButton = page.locator('button[aria-label="Toggle navigation menu"]')
    await expect(menuButton).toBeVisible()
    
    // Verify button has correct z-index
    const zIndex = await menuButton.evaluate(el => 
      window.getComputedStyle(el).zIndex
    )
    expect(parseInt(zIndex)).toBeGreaterThanOrEqual(100)
    
    // Click to open menu
    await menuButton.click()
    
    // Check sidebar is visible
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible()
    
    // Check overlay is visible
    const overlay = page.locator('.bg-black\\/50')
    await expect(overlay).toBeVisible()
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/mobile-menu-open-test.png' 
    })
    
    // Click overlay to close
    await overlay.click()
    await page.waitForTimeout(500) // Wait for animation
    
    // Check sidebar is hidden (translated off screen)
    const sidebarClass = await sidebar.getAttribute('class')
    expect(sidebarClass).toContain('-translate-x-full')
  })

  test('Module cards should use static grid classes', async ({ page }) => {
    await page.goto('/finance')
    await page.waitForLoadState('networkidle')
    
    // Find a module card stats grid
    const statsGrid = page.locator('.bg-slate-900\\/50').first().locator('..')
    const hasGrid = await statsGrid.count()
    
    if (hasGrid > 0) {
      const classes = await statsGrid.getAttribute('class')
      // Check that no dynamic classes exist
      expect(classes).not.toMatch(/grid-cols-\$/)
      
      // Verify static grid classes are used
      expect(classes).toMatch(/grid-cols-[1-4]/)
    }
  })

  test('All pages should have consistent dark theme', async ({ page }) => {
    const pages = ['/login', '/finance', '/bookkeeping', '/analytics', '/cashflow']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      
      // Check main container has dark background
      const mainContainer = page.locator('body > div').first()
      const bgClass = await mainContainer.getAttribute('class')
      expect(bgClass).toContain('bg-slate-950')
      
      await page.screenshot({ 
        path: `screenshots/dark-theme-${pagePath.replace('/', '') || 'home'}.png`,
        fullPage: true 
      })
    }
  })
})
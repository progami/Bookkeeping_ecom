import { Page, expect } from '@playwright/test'

/**
 * Helper functions for testing toast notifications
 */

export async function waitForToast(page: Page, message: string | RegExp, options?: {
  timeout?: number
  type?: 'success' | 'error' | 'loading'
}) {
  const timeout = options?.timeout || 5000
  const type = options?.type || 'success'
  
  // Common toast selectors for different toast libraries
  const toastSelectors = [
    // React Hot Toast (commonly used)
    `[role="status"]:has-text("${message}")`,
    `[class*="toast"]:has-text("${message}")`,
    `.toast-${type}:has-text("${message}")`,
    
    // Generic toast selectors
    `[data-testid="toast"]:has-text("${message}")`,
    `[class*="notification"]:has-text("${message}")`,
    `[class*="alert"]:has-text("${message}")`,
    
    // Custom implementation
    `.fixed:has-text("${message}")`,
    `div[class*="${type}"]:has-text("${message}")`
  ]
  
  // Try each selector
  for (const selector of toastSelectors) {
    try {
      const toast = page.locator(selector)
      await toast.waitFor({ state: 'visible', timeout: 1000 })
      return toast
    } catch (e) {
      // Continue to next selector
    }
  }
  
  // If no specific selector worked, use a more general approach
  const generalToast = page.locator(`text="${message}"`).first()
  await expect(generalToast).toBeVisible({ timeout })
  return generalToast
}

export async function expectSuccessToast(page: Page, message: string | RegExp) {
  const toast = await waitForToast(page, message, { type: 'success' })
  await expect(toast).toBeVisible()
  
  // Success toasts usually auto-dismiss
  await expect(toast).not.toBeVisible({ timeout: 5000 })
}

export async function expectErrorToast(page: Page, message: string | RegExp) {
  const toast = await waitForToast(page, message, { type: 'error' })
  await expect(toast).toBeVisible()
}

export async function expectLoadingToast(page: Page, message: string | RegExp) {
  const toast = await waitForToast(page, message, { type: 'loading' })
  await expect(toast).toBeVisible()
  return toast
}

export async function dismissToast(page: Page, toast: any) {
  // Try common dismiss methods
  const dismissButton = toast.locator('button[aria-label="Close"]')
  if (await dismissButton.isVisible()) {
    await dismissButton.click()
  } else {
    // Some toasts dismiss when clicked
    await toast.click().catch(() => {})
  }
  
  await expect(toast).not.toBeVisible()
}

// Helper to wait for all toasts to disappear
export async function waitForToastsToDisappear(page: Page, timeout = 5000) {
  await page.waitForTimeout(500) // Give toasts time to appear
  
  const toastSelectors = [
    '[role="status"]',
    '[class*="toast"]',
    '[data-testid="toast"]',
    '.fixed[class*="bg-"][class*="text-white"]'
  ]
  
  for (const selector of toastSelectors) {
    const toasts = page.locator(selector)
    const count = await toasts.count()
    
    if (count > 0) {
      // Wait for all matching toasts to disappear
      for (let i = 0; i < count; i++) {
        await expect(toasts.nth(i)).not.toBeVisible({ timeout })
      }
    }
  }
}
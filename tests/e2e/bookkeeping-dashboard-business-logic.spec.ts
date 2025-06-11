import { test, expect, Page } from '@playwright/test'

test.describe('Bookkeeping Dashboard - Business Logic Tests', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Financial Data Accuracy', () => {
    test('Cash in Bank should equal sum of all bank account balances', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get Cash in Bank value
        const cashInBankCard = page.locator('div:has-text("Cash in Bank")').locator('..')
        const cashInBankText = await cashInBankCard.locator('div.text-3xl').textContent()
        const cashInBankValue = parseFloat(cashInBankText?.replace(/[£$€,]/g, '') || '0')
        
        // Get all bank account balances
        const bankCards = page.locator('div[onclick*="transactions"]')
        const bankCount = await bankCards.count()
        
        let totalBankBalances = 0
        for (let i = 0; i < bankCount; i++) {
          const balanceText = await bankCards.nth(i).locator('div.text-lg').textContent()
          const balance = parseFloat(balanceText?.replace(/[£$€,]/g, '') || '0')
          totalBankBalances += balance
        }
        
        // Cash in Bank should equal sum of bank balances
        expect(Math.abs(cashInBankValue - totalBankBalances)).toBeLessThan(0.01)
      }
    })

    test('Net Cash Flow should equal Income minus Expenses', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get Income value
        const incomeCard = page.locator('div:has-text("Income")').filter({ hasText: /\d+d/ }).locator('..')
        const incomeText = await incomeCard.locator('div.text-3xl').textContent()
        const incomeValue = parseFloat(incomeText?.replace(/[£$€,]/g, '') || '0')
        
        // Get Expenses value
        const expensesCard = page.locator('div:has-text("Expenses")').filter({ hasText: /\d+d/ }).locator('..')
        const expensesText = await expensesCard.locator('div.text-3xl').textContent()
        const expensesValue = parseFloat(expensesText?.replace(/[£$€,]/g, '') || '0')
        
        // Get Net Cash Flow value
        const netCashFlowCard = page.locator('div:has-text("Net Cash Flow")').locator('..')
        const netCashFlowText = await netCashFlowCard.locator('div.text-3xl').textContent()
        const netCashFlowValue = parseFloat(netCashFlowText?.replace(/[£$€,-]/g, '') || '0')
        const isNegative = netCashFlowText?.includes('-') || false
        
        // Calculate expected net cash flow
        const expectedNetCashFlow = incomeValue - expensesValue
        const actualNetCashFlow = isNegative ? -netCashFlowValue : netCashFlowValue
        
        // Should match with small tolerance for rounding
        expect(Math.abs(actualNetCashFlow - expectedNetCashFlow)).toBeLessThan(0.01)
      }
    })

    test('Period comparison percentages should be calculated correctly', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Check income growth percentage
        const incomeCard = page.locator('div:has-text("Income")').filter({ hasText: /\d+d/ }).locator('..')
        const incomePercentage = await incomeCard.locator('span.text-xs').textContent()
        
        if (incomePercentage) {
          // Should be a valid percentage format
          expect(incomePercentage).toMatch(/^[+-]?\d+(\.\d+)?%$/)
          
          // If positive, should be green; if negative, should be red
          const percentageElement = incomeCard.locator('span.text-xs')
          const classes = await percentageElement.getAttribute('class')
          
          if (incomePercentage.startsWith('+')) {
            expect(classes).toContain('text-green')
          } else if (incomePercentage.startsWith('-')) {
            expect(classes).toContain('text-red')
          }
        }
      }
    })
  })

  test.describe('Bank Account Data Integrity', () => {
    test('Each bank account should show unreconciled count matching actual data', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get total unreconciled from Reconciliation section
        const reconciliationSection = page.locator('div:has-text("Reconciliation")').locator('..')
        const totalUnreconciledText = await reconciliationSection.locator('div.text-4xl').textContent()
        const totalUnreconciled = parseInt(totalUnreconciledText || '0')
        
        // Sum unreconciled from each bank account
        const bankCards = page.locator('div[onclick*="transactions"]')
        const bankCount = await bankCards.count()
        
        let sumUnreconciled = 0
        for (let i = 0; i < bankCount; i++) {
          const unreconciledText = await bankCards.nth(i).locator('span:has-text("unreconciled")').textContent()
          if (unreconciledText) {
            const count = parseInt(unreconciledText.match(/\d+/)?.[0] || '0')
            sumUnreconciled += count
          }
        }
        
        // Total should match sum of individual accounts
        expect(totalUnreconciled).toBe(sumUnreconciled)
      }
    })

    test('Bank account last updated dates should be recent', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        const bankCards = page.locator('div[onclick*="transactions"]')
        const bankCount = await bankCards.count()
        
        const today = new Date()
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
        
        for (let i = 0; i < bankCount; i++) {
          const dateText = await bankCards.nth(i).locator('text=/Updated|\\d+\\/\\d+/').textContent()
          if (dateText) {
            // Extract date from text like "Updated 1/10/2025"
            const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              const [_, month, day, year] = dateMatch
              const updateDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
              
              // Should be updated within last 30 days
              expect(updateDate.getTime()).toBeGreaterThan(thirtyDaysAgo.getTime())
            }
          }
        }
      }
    })
  })

  test.describe('Time Range Functionality', () => {
    test('Changing time range should update all financial metrics', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get initial 30-day values
        const income30d = await page.locator('div:has-text("Income")').filter({ hasText: /30d/ }).locator('..').locator('div.text-3xl').textContent()
        const expenses30d = await page.locator('div:has-text("Expenses")').filter({ hasText: /30d/ }).locator('..').locator('div.text-3xl').textContent()
        
        // Change to 7 days
        const timeRangeSelect = page.locator('select').first()
        await timeRangeSelect.selectOption('7d')
        
        // Wait for data to reload
        await page.waitForTimeout(1000)
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get 7-day values
        const income7d = await page.locator('div:has-text("Income")').filter({ hasText: /7d/ }).locator('..').locator('div.text-3xl').textContent()
        const expenses7d = await page.locator('div:has-text("Expenses")').filter({ hasText: /7d/ }).locator('..').locator('div.text-3xl').textContent()
        
        // Values should have changed (7 days should typically be less than 30 days)
        const income7dValue = parseFloat(income7d?.replace(/[£$€,]/g, '') || '0')
        const income30dValue = parseFloat(income30d?.replace(/[£$€,]/g, '') || '0')
        
        // 7-day income should be less than or equal to 30-day income
        expect(income7dValue).toBeLessThanOrEqual(income30dValue)
        
        // Period label should update
        const periodLabel = await page.locator('div:has-text("Income")').filter({ hasText: /\d+d/ }).locator('..').textContent()
        expect(periodLabel).toContain('7d')
      }
    })
  })

  test.describe('Automation Metrics', () => {
    test('Match rate should be between 0 and 100 percent', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        const automationSection = page.locator('h2:has-text("Automation")').locator('..')
        const matchRateText = await automationSection.locator('text=/%/').textContent()
        
        if (matchRateText) {
          const matchRate = parseFloat(matchRateText.match(/(\d+(\.\d+)?)/)?.[1] || '0')
          
          // Should be a valid percentage
          expect(matchRate).toBeGreaterThanOrEqual(0)
          expect(matchRate).toBeLessThanOrEqual(100)
          
          // Progress bar width should match percentage
          const progressBar = await automationSection.locator('.bg-indigo-500').getAttribute('style')
          expect(progressBar).toContain(`width: ${matchRate}%`)
        }
      }
    })

    test('Active rules count should not exceed total rules', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        const automationSection = page.locator('h2:has-text("Automation")').locator('..')
        const rulesText = await automationSection.locator('text=/\\d+ \\/ \\d+/').textContent()
        
        if (rulesText) {
          const [activeStr, totalStr] = rulesText.split('/').map(s => s.trim())
          const activeRules = parseInt(activeStr)
          const totalRules = parseInt(totalStr)
          
          // Active should not exceed total
          expect(activeRules).toBeLessThanOrEqual(totalRules)
          expect(activeRules).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  test.describe('Navigation and Actions', () => {
    test('Clicking bank account should navigate to filtered transactions', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        const firstBankCard = page.locator('div[onclick*="transactions"]').first()
        const bankName = await firstBankCard.locator('h3').textContent()
        
        if (bankName) {
          await firstBankCard.click()
          
          // Should navigate to transactions page
          await expect(page).toHaveURL(/\/transactions/)
          
          // Bank account filter should be pre-selected
          // TODO: Verify the filter is set to the clicked bank account
        }
      }
    })

    test('Start Reconciling should navigate to unreconciled transactions only', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        const startReconcilingButton = page.locator('button:has-text("Start Reconciling")')
        if (await startReconcilingButton.isVisible()) {
          await startReconcilingButton.click()
          
          // Should navigate with unreconciled filter
          await expect(page).toHaveURL(/\/transactions.*filter=unreconciled/)
        }
      }
    })
  })

  test.describe('Real-time Sync Verification', () => {
    test('Sync Now should update last sync time and potentially change data', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get initial income value
        const initialIncome = await page.locator('div:has-text("Income")').locator('..').locator('div.text-3xl').textContent()
        
        // Click Sync Now
        const syncButton = page.locator('button:has-text("Sync Now")')
        await syncButton.click()
        
        // Should show syncing state
        await expect(syncButton.locator('.animate-spin')).toBeVisible()
        
        // Wait for sync to complete
        await expect(syncButton.locator('.animate-spin')).not.toBeVisible({ timeout: 30000 })
        
        // Data might have changed
        const newIncome = await page.locator('div:has-text("Income")').locator('..').locator('div.text-3xl').textContent()
        
        // Values should be valid (even if unchanged)
        expect(newIncome).toMatch(/[£$€]\s*[\d,]+/)
      }
    })
  })
})
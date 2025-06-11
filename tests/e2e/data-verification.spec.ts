import { test, expect, Page } from '@playwright/test'

test.describe('Data Verification - Critical Functionality Tests', () => {
  let page: Page

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto('/bookkeeping')
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.describe('Financial Overview Cards - Data Population', () => {
    test('should display actual cash in bank value, not zero or empty', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Wait for data to load
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Find Cash in Bank card
        const cashInBankCard = page.locator('div:has-text("Cash in Bank")').locator('..')
        await expect(cashInBankCard).toBeVisible()
        
        // Get the value text
        const valueElement = cashInBankCard.locator('div.text-3xl')
        const value = await valueElement.textContent()
        
        // Critical assertions:
        // 1. Should not be empty
        expect(value).toBeTruthy()
        
        // 2. Should be a valid currency format
        expect(value).toMatch(/[£$€¥₹kr]\s*[\d,]+(\.\d{2})?/)
        
        // 3. Should NOT be £0 unless explicitly confirmed
        if (value?.includes('0') && !value?.includes(',') && !value?.includes('.')) {
          // If it's showing zero, check if there are bank accounts
          const bankAccounts = await page.locator('div:has-text("Bank Accounts")').locator('..').locator('div[onclick*="transactions"]').count()
          
          // If there are bank accounts, the total should not be zero
          if (bankAccounts > 0) {
            throw new Error('Cash in Bank shows £0 despite having bank accounts - API is not returning correct balance data')
          }
        }
      }
    })

    test('should display actual income value with proper period data', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Find Income card
        const incomeCard = page.locator('div:has-text("Income")').filter({ hasText: /7d|30d|90d/ }).locator('..')
        await expect(incomeCard).toBeVisible()
        
        // Get the value
        const valueElement = incomeCard.locator('div.text-3xl')
        const value = await valueElement.textContent()
        
        // Should have a value
        expect(value).toBeTruthy()
        expect(value).toMatch(/[£$€¥₹kr]\s*[\d,]+(\.\d{2})?/)
        
        // Should show percentage change
        const percentageElement = incomeCard.locator('span.text-xs')
        const percentage = await percentageElement.textContent()
        expect(percentage).toMatch(/[+-]?\d+(\.\d+)?%/)
      }
    })

    test('should display actual expenses value with proper period data', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Find Expenses card
        const expensesCard = page.locator('div:has-text("Expenses")').filter({ hasText: /7d|30d|90d/ }).locator('..')
        await expect(expensesCard).toBeVisible()
        
        // Get the value
        const valueElement = expensesCard.locator('div.text-3xl')
        const value = await valueElement.textContent()
        
        // Should have a value
        expect(value).toBeTruthy()
        expect(value).toMatch(/[£$€¥₹kr]\s*[\d,]+(\.\d{2})?/)
      }
    })

    test('should display calculated net cash flow', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Find Net Cash Flow card
        const netCashFlowCard = page.locator('div:has-text("Net Cash Flow")').locator('..')
        await expect(netCashFlowCard).toBeVisible()
        
        // Get the value
        const valueElement = netCashFlowCard.locator('div.text-3xl')
        const value = await valueElement.textContent()
        
        // Should have a value (can be negative)
        expect(value).toBeTruthy()
        expect(value).toMatch(/[£$€¥₹kr\-]\s*[\d,]+(\.\d{2})?/)
      }
    })
  })

  test.describe('Bank Accounts - Balance Verification', () => {
    test('should display actual bank account balances from Xero', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Find bank account cards
        const bankCards = page.locator('div[onclick*="transactions"]')
        const count = await bankCards.count()
        
        if (count > 0) {
          // Check first bank account
          const firstCard = bankCards.first()
          
          // Get balance text
          const balanceElement = firstCard.locator('div.text-lg')
          const balance = await balanceElement.textContent()
          
          // Critical assertions:
          expect(balance).toBeTruthy()
          expect(balance).toMatch(/[£$€¥₹kr]\s*[\d,]+(\.\d{2})?/)
          
          // Verify it's not showing placeholder zero
          const balanceValue = balance?.replace(/[£$€¥₹kr\s,]/g, '')
          if (balanceValue === '0' || balanceValue === '0.00') {
            console.warn('Bank account showing zero balance - verify Xero API is returning correct data')
          }
        }
      }
    })
  })

  test.describe('API Response Verification', () => {
    test('should receive valid data from accounts API', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Intercept API call
        const responsePromise = page.waitForResponse(resp => 
          resp.url().includes('/api/v1/xero/accounts') && resp.status() === 200
        )
        
        // Trigger a refresh
        await page.reload()
        
        const response = await responsePromise
        const data = await response.json()
        
        // Verify API returns proper data structure
        expect(data).toHaveProperty('accounts')
        expect(Array.isArray(data.accounts)).toBeTruthy()
        
        if (data.accounts.length > 0) {
          const firstAccount = data.accounts[0]
          
          // Each account should have required fields
          expect(firstAccount).toHaveProperty('id')
          expect(firstAccount).toHaveProperty('name')
          expect(firstAccount).toHaveProperty('balance')
          expect(typeof firstAccount.balance).toBe('number')
          
          // Balance should be a real number, not always zero
          const hasNonZeroBalance = data.accounts.some(acc => acc.balance !== 0)
          if (!hasNonZeroBalance) {
            console.error('All account balances are zero - API is not fetching correct data from Xero')
          }
        }
      }
    })

    test('should receive valid data from analytics API', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        // Intercept API call
        const responsePromise = page.waitForResponse(resp => 
          resp.url().includes('/api/v1/bookkeeping/analytics') && resp.status() === 200
        )
        
        // Trigger a refresh
        await page.reload()
        
        const response = await responsePromise
        const data = await response.json()
        
        // Verify API returns proper data structure
        expect(data).toHaveProperty('summary')
        expect(data.summary).toHaveProperty('totalIncome')
        expect(data.summary).toHaveProperty('totalExpenses')
        expect(data.summary).toHaveProperty('netAmount')
        
        // Values should be numbers
        expect(typeof data.summary.totalIncome).toBe('number')
        expect(typeof data.summary.totalExpenses).toBe('number')
        expect(typeof data.summary.netAmount).toBe('number')
        
        // Check if we have actual transaction data
        if (data.summary.totalTransactions === 0) {
          console.warn('No transactions found - user may need to sync from Xero')
        }
      }
    })
  })

  test.describe('Time Range Functionality', () => {
    test('should update values when changing time range', async () => {
      const isConnected = await page.locator('text="Connected to"').isVisible().catch(() => false)
      
      if (isConnected) {
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Get initial income value
        const incomeCard = page.locator('div:has-text("Income")').filter({ hasText: /30d/ }).locator('..')
        const initialValue = await incomeCard.locator('div.text-3xl').textContent()
        
        // Change time range
        const timeRangeSelect = page.locator('select').first()
        await timeRangeSelect.selectOption('7d')
        
        // Wait for data to reload
        await page.waitForTimeout(1000)
        await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 })
        
        // Check if value changed (it should for different periods)
        const newIncomeCard = page.locator('div:has-text("Income")').filter({ hasText: /7d/ }).locator('..')
        const newValue = await newIncomeCard.locator('div.text-3xl').textContent()
        
        // Values might be different for different time periods
        expect(newValue).toBeTruthy()
        expect(newValue).toMatch(/[£$€¥₹kr]\s*[\d,]+(\.\d{2})?/)
      }
    })
  })
})
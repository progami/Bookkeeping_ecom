import { Page } from '@playwright/test'
import { mockXeroData, generateMockTransactions } from '../mocks/xero-mock-data'

export async function setupXeroMocks(page: Page) {
  // Mock Xero connection status
  await page.route('**/api/v1/xero/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: true,
        tenantId: mockXeroData.connectionStatus.tenantId,
        tenantName: mockXeroData.connectionStatus.tenantName,
        lastSyncedAt: mockXeroData.connectionStatus.lastSyncedAt
      })
    })
  })

  // Mock bank accounts
  await page.route('**/api/v1/xero/accounts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accounts: mockXeroData.bankAccounts
      })
    })
  })

  // Mock transactions
  await page.route('**/api/v1/xero/transactions**', async route => {
    const url = new URL(route.request().url())
    const accountId = url.searchParams.get('accountId')
    const status = url.searchParams.get('status')
    
    let transactions = [...mockXeroData.transactions]
    
    // Add more transactions for pagination testing
    if (url.searchParams.get('page')) {
      transactions = generateMockTransactions(20, new Date())
    }
    
    // Filter by account if specified
    if (accountId) {
      transactions = transactions.filter(t => 
        t.bankAccount.accountID === accountId
      )
    }
    
    // Filter by status if specified
    if (status === 'unreconciled') {
      transactions = transactions.filter(t => !t.isReconciled)
    } else if (status === 'reconciled') {
      transactions = transactions.filter(t => t.isReconciled)
    }
    
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transactions,
        pagination: {
          page: 1,
          pageSize: 50,
          pageCount: 1,
          itemCount: transactions.length
        }
      })
    })
  })

  // Mock GL accounts
  await page.route('**/api/v1/xero/gl-accounts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accounts: mockXeroData.glAccounts
      })
    })
  })

  // Mock sync endpoints
  await page.route('**/api/v1/xero/sync**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Sync completed',
        syncedCount: 10
      })
    })
  })

  // Mock bookkeeping stats
  await page.route('**/api/v1/bookkeeping/stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockXeroData.stats)
    })
  })

  // Mock transaction reconciliation
  await page.route('**/api/v1/xero/transactions/*/reconcile', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Transaction reconciled successfully'
      })
    })
  })

  // Mock OAuth routes to simulate connected state
  await page.route('**/api/v1/xero/auth**', async route => {
    if (route.request().url().includes('callback')) {
      await route.fulfill({
        status: 302,
        headers: {
          'Location': '/bookkeeping?connected=true'
        }
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authUrl: 'https://login.xero.com/mock-auth'
        })
      })
    }
  })

  // Mock disconnect
  await page.route('**/api/v1/xero/disconnect', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'Disconnected from Xero'
      })
    })
  })
}

// Helper to setup only essential mocks for faster tests
export async function setupMinimalXeroMocks(page: Page) {
  // Just mock connection status as connected
  await page.route('**/api/v1/xero/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: true,
        tenantId: 'mock-tenant-id',
        tenantName: 'Mock Organization'
      })
    })
  })

  // Mock minimal stats
  await page.route('**/api/v1/bookkeeping/stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalTransactions: 10,
        reconciledCount: 5,
        unreconciledCount: 5,
        totalIncome: 5000,
        totalExpenses: 2000,
        netCashFlow: 3000
      })
    })
  })
}

// Helper to simulate disconnected state
export async function setupDisconnectedMocks(page: Page) {
  await page.route('**/api/v1/xero/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: false,
        tenantId: null,
        tenantName: null
      })
    })
  })
}
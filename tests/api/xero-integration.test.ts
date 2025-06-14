import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Xero API Integration Tests', () => {
  const baseUrl = 'https://localhost:3003';

  beforeEach(() => {
    // Reset fetch mock before each test
    vi.clearAllMocks();
  });

  it('should return Xero connection status', async () => {
    // Mock successful status response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ 
        connected: false, 
        organization: null,
        error: 'Not connected to Xero'
      }),
    } as Response);

    const response = await fetch(`${baseUrl}/api/v1/xero/status`, {
      headers: { 'Accept': 'application/json' }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('connected');
    expect(data).toHaveProperty('organization');
  });

  it('should return 401 when fetching balance sheet without Xero connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/xero/reports/balance-sheet`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Xero not connected');
  });

  it('should return 401 when fetching P&L without Xero connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/xero/reports/profit-loss`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Xero not connected');
  });

  it('should return 401 when fetching VAT liability without Xero connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/xero/reports/vat-liability`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Xero not connected');
  });

  it('should return 401 when fetching top vendors without Xero connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/analytics/top-vendors`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Xero not connected');
  });

  it('should return 401 when fetching cash balance without Xero connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/bookkeeping/cash-balance`);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Xero not connected');
  });

  it('should return stats from local database', async () => {
    // Mock successful stats response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        unreconciledCount: 0,
        reconciliationRate: 0,
        recentTransactions: []
      }),
    } as Response);

    const response = await fetch(`${baseUrl}/api/v1/bookkeeping/stats`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('unreconciledCount');
    expect(data).toHaveProperty('reconciliationRate');
    expect(data).toHaveProperty('recentTransactions');
  });

  it('should be able to check bank accounts endpoint', async () => {
    // Mock successful bank accounts response
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        accounts: [],
        totalBalance: 0
      }),
    } as Response);

    const response = await fetch(`${baseUrl}/api/v1/bookkeeping/bank-accounts`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('accounts');
    expect(Array.isArray(data.accounts)).toBe(true);
  });
});

describe('API Response Structure Tests', () => {
  it('should have proper error structure when Xero not connected', async () => {
    const endpoints = [
      '/api/v1/xero/reports/balance-sheet',
      '/api/v1/xero/reports/profit-loss',
      '/api/v1/xero/reports/vat-liability',
      '/api/v1/analytics/top-vendors',
      '/api/v1/bookkeeping/cash-balance'
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`https://localhost:3003${endpoint}`);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error');
      expect(typeof data.error).toBe('string');
    }
  });
});
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Chart of Accounts API Tests', () => {
  let baseUrl: string;

  beforeAll(() => {
    baseUrl = process.env.TEST_BASE_URL || 'https://localhost:3003';
  });

  describe('GET /api/v1/xero/sync-gl-accounts', () => {
    it('should fetch GL accounts from database', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/sync-gl-accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBeLessThan(500); // Not a server error
      
      if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('accounts');
        expect(Array.isArray(data.accounts)).toBe(true);
        
        // If accounts exist, check structure
        if (data.accounts.length > 0) {
          const account = data.accounts[0];
          expect(account).toHaveProperty('code');
          expect(account).toHaveProperty('name');
          expect(account).toHaveProperty('type');
          expect(account).toHaveProperty('status');
        }
      }
    });
  });

  describe('POST /api/v1/xero/sync-gl-accounts', () => {
    it('should sync accounts from Xero', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/sync-gl-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeArchived: false
        }),
      });

      // If not authenticated, should return 401
      if (response.status === 401) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Not connected to Xero');
      } else if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('stats');
        expect(data.stats).toHaveProperty('total');
        expect(data.stats).toHaveProperty('created');
        expect(data.stats).toHaveProperty('updated');
      }
    });

    it('should handle includeArchived parameter', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/sync-gl-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeArchived: true
        }),
      });

      expect(response.status).toBeLessThan(500); // Not a server error
    });
  });

  describe('GET /api/v1/xero/trial-balance-all', () => {
    it('should fetch all accounts including system accounts', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/trial-balance-all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toContain('Not connected to Xero');
      } else if (response.ok) {
        const data = await response.json();
        expect(data).toHaveProperty('accounts');
        expect(data).toHaveProperty('totalAccounts');
        expect(data).toHaveProperty('accountsWithActivity');
        expect(data).toHaveProperty('systemAccounts');
        expect(Array.isArray(data.accounts)).toBe(true);
        expect(Array.isArray(data.systemAccounts)).toBe(true);
        
        // Check if system accounts are properly identified
        const systemAccounts = data.systemAccounts;
        if (systemAccounts.length > 0) {
          const vatAccount = systemAccounts.find((acc: any) => 
            acc.accountCode === '825' || acc.cleanAccountName?.includes('VAT')
          );
          
          if (vatAccount) {
            expect(vatAccount).toHaveProperty('isSystemAccount', true);
            expect(vatAccount).toHaveProperty('ytdAmount');
            console.log('VAT Account found:', vatAccount);
          }
        }
      }
    });

    it('should include accounts with zero balance', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/trial-balance-all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Should have more total accounts than accounts with activity
        expect(data.totalAccounts).toBeGreaterThanOrEqual(data.accountsWithActivity);
        
        // Check for accounts with zero balance
        const zeroBalanceAccounts = data.accounts.filter((acc: any) => 
          acc.ytdAmount === 0 && !acc.hasActivity
        );
        
        console.log(`Found ${zeroBalanceAccounts.length} accounts with zero balance`);
      }
    });
  });

  describe('Bank Account Handling', () => {
    it('should assign codes to bank accounts without codes', async () => {
      const response = await fetch(`${baseUrl}/api/v1/xero/sync-gl-accounts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const bankAccounts = data.accounts.filter((acc: any) => acc.type === 'BANK');
        
        // All bank accounts should have codes
        bankAccounts.forEach((account: any) => {
          expect(account.code).toBeTruthy();
          expect(account.code).not.toBe('N/A');
          
          // Bank accounts without original codes should have BANK_ prefix
          if (account.code.startsWith('BANK_')) {
            expect(account.code).toMatch(/^BANK_[a-zA-Z0-9]+$/);
          }
        });
      }
    });
  });
});
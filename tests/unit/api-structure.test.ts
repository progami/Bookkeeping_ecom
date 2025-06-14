import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

describe('API Structure and Implementation Tests', () => {
  const apiBasePath = join(process.cwd(), 'app/api/v1');

  describe('Xero Report APIs', () => {
    it('should have Balance Sheet API endpoint', () => {
      const balanceSheetPath = join(apiBasePath, 'xero/reports/balance-sheet/route.ts');
      expect(existsSync(balanceSheetPath)).toBe(true);
    });

    it('should have Profit & Loss API endpoint', () => {
      const plPath = join(apiBasePath, 'xero/reports/profit-loss/route.ts');
      expect(existsSync(plPath)).toBe(true);
    });

    it('should have VAT Liability API endpoint', () => {
      const vatPath = join(apiBasePath, 'xero/reports/vat-liability/route.ts');
      expect(existsSync(vatPath)).toBe(true);
    });
  });

  describe('Analytics APIs', () => {
    it('should have Top Vendors API endpoint', () => {
      const vendorsPath = join(apiBasePath, 'analytics/top-vendors/route.ts');
      expect(existsSync(vendorsPath)).toBe(true);
    });
  });

  describe('Bookkeeping APIs', () => {
    it('should have Cash Balance API endpoint', () => {
      const cashBalancePath = join(apiBasePath, 'bookkeeping/cash-balance/route.ts');
      expect(existsSync(cashBalancePath)).toBe(true);
    });

    it('should have Stats API endpoint', () => {
      const statsPath = join(apiBasePath, 'bookkeeping/stats/route.ts');
      expect(existsSync(statsPath)).toBe(true);
    });

    it('should have Bank Accounts API endpoint', () => {
      const bankAccountsPath = join(apiBasePath, 'bookkeeping/bank-accounts/route.ts');
      expect(existsSync(bankAccountsPath)).toBe(true);
    });
  });

  describe('Cash Flow APIs', () => {
    it('should have Forecast API endpoint', () => {
      const forecastPath = join(apiBasePath, 'cashflow/forecast/route.ts');
      expect(existsSync(forecastPath)).toBe(true);
    });

    it('should have Sync API endpoint', () => {
      const syncPath = join(apiBasePath, 'cashflow/sync/route.ts');
      expect(existsSync(syncPath)).toBe(true);
    });
  });

  describe('Removed Features', () => {
    it('should NOT have automation rules API', () => {
      const rulesPath = join(apiBasePath, 'bookkeeping/rules/route.ts');
      expect(existsSync(rulesPath)).toBe(false);
    });

    it('should NOT have automation rules ID route', () => {
      const rulesIdPath = join(apiBasePath, 'bookkeeping/rules/[id]/route.ts');
      expect(existsSync(rulesIdPath)).toBe(false);
    });
  });
});

describe('UI Component Structure Tests', () => {
  const appBasePath = join(process.cwd(), 'app');

  it('should have Finance Dashboard page', () => {
    const financePath = join(appBasePath, 'finance/page.tsx');
    expect(existsSync(financePath)).toBe(true);
  });

  it('should have Bookkeeping Dashboard page', () => {
    const bookkeepingPath = join(appBasePath, 'bookkeeping/page.tsx');
    expect(existsSync(bookkeepingPath)).toBe(true);
  });

  it('should have Analytics page', () => {
    const analyticsPath = join(appBasePath, 'analytics/page.tsx');
    expect(existsSync(analyticsPath)).toBe(true);
  });

  it('should have Cash Flow page', () => {
    const cashflowPath = join(appBasePath, 'cashflow/page.tsx');
    expect(existsSync(cashflowPath)).toBe(true);
  });

  it('should have SOP Generator page', () => {
    const sopGenPath = join(appBasePath, 'bookkeeping/sop-generator/page.tsx');
    expect(existsSync(sopGenPath)).toBe(true);
  });

  it('should have Chart of Accounts page', () => {
    const chartPath = join(appBasePath, 'bookkeeping/chart-of-accounts/page.tsx');
    expect(existsSync(chartPath)).toBe(true);
  });

  it('should NOT have automation rules page', () => {
    const rulesPath = join(appBasePath, 'bookkeeping/rules/page.tsx');
    expect(existsSync(rulesPath)).toBe(false);
  });
});

describe('Library Implementation Tests', () => {
  const libBasePath = join(process.cwd(), 'lib');

  it('should have CashFlowEngine implementation', () => {
    const enginePath = join(libBasePath, 'cashflow-engine.ts');
    expect(existsSync(enginePath)).toBe(true);
  });

  it('should have Xero client implementation', () => {
    const xeroClientPath = join(libBasePath, 'xero-client.ts');
    expect(existsSync(xeroClientPath)).toBe(true);
  });

  it('should NOT have transaction matcher (rules engine)', () => {
    const matcherPath = join(libBasePath, 'transaction-matcher.ts');
    expect(existsSync(matcherPath)).toBe(false);
  });
});
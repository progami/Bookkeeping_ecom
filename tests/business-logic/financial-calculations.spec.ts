import { test, expect } from '@playwright/test';

test.describe('Financial Calculations Business Logic Tests', () => {
  test('Balance Sheet calculations should be accurate', async ({ page }) => {
    // Navigate to bookkeeping dashboard
    await page.goto('/bookkeeping');
    
    // Get Balance Sheet values
    const netAssetsText = await page.locator('text=Net Assets').locator('..').locator('text=/£[0-9,]+/').textContent();
    const netAssets = parseFloat(netAssetsText?.replace(/[£,]/g, '') || '0');
    
    // Navigate to the Balance Sheet API directly
    const response = await page.request.get('/api/v1/xero/reports/balance-sheet');
    const balanceSheetData = await response.json();
    
    // Verify calculations
    expect(balanceSheetData.totalAssets).toBeGreaterThanOrEqual(0);
    expect(balanceSheetData.totalLiabilities).toBeGreaterThanOrEqual(0);
    expect(balanceSheetData.netAssets).toBe(balanceSheetData.totalAssets - balanceSheetData.totalLiabilities);
  });

  test('Profit & Loss calculations should be accurate', async ({ page }) => {
    // Get P&L data from API
    const response = await page.request.get('/api/v1/xero/reports/profit-loss');
    const plData = await response.json();
    
    // Verify calculations
    expect(plData.revenue).toBeGreaterThanOrEqual(0);
    expect(plData.expenses).toBeGreaterThanOrEqual(0);
    expect(plData.netProfit).toBe(plData.revenue - plData.expenses);
    
    // Verify profit margin calculation if revenue > 0
    if (plData.revenue > 0) {
      const expectedMargin = (plData.netProfit / plData.revenue) * 100;
      expect(Math.abs(plData.profitMargin - expectedMargin)).toBeLessThan(0.01);
    }
  });

  test('VAT Liability calculations should be logical', async ({ page }) => {
    // Get VAT data from API
    const response = await page.request.get('/api/v1/xero/reports/vat-liability');
    const vatData = await response.json();
    
    // Verify VAT calculations
    expect(vatData.vatCollected).toBeGreaterThanOrEqual(0);
    expect(vatData.vatPaid).toBeGreaterThanOrEqual(0);
    expect(vatData.currentLiability).toBeGreaterThanOrEqual(0);
    
    // Net amount should be collected minus paid
    const expectedNet = vatData.vatCollected - vatData.vatPaid;
    expect(Math.abs(vatData.netAmount - expectedNet)).toBeLessThan(0.01);
  });

  test('Cash Balance aggregation should be accurate', async ({ page }) => {
    // Get cash balance from API
    const response = await page.request.get('/api/v1/bookkeeping/cash-balance');
    const cashData = await response.json();
    
    // Verify cash balance calculations
    expect(cashData.totalBalance).toBeGreaterThanOrEqual(0);
    expect(cashData.accounts).toBeInstanceOf(Array);
    
    // Sum of individual accounts should equal total
    const calculatedTotal = cashData.accounts.reduce((sum: number, account: any) => sum + account.balance, 0);
    expect(Math.abs(cashData.totalBalance - calculatedTotal)).toBeLessThan(0.01);
  });

  test('Top Vendors analysis should be accurate', async ({ page }) => {
    // Get vendors data from API
    const response = await page.request.get('/api/v1/analytics/top-vendors?period=30d');
    const vendorsData = await response.json();
    
    // Verify vendors calculations
    expect(vendorsData.vendors).toBeInstanceOf(Array);
    expect(vendorsData.totalSpend).toBeGreaterThanOrEqual(0);
    
    // Verify vendors are sorted by spend (descending)
    for (let i = 1; i < vendorsData.vendors.length; i++) {
      expect(vendorsData.vendors[i - 1].totalSpend).toBeGreaterThanOrEqual(vendorsData.vendors[i].totalSpend);
    }
    
    // Verify percentage calculations
    vendorsData.vendors.forEach((vendor: any) => {
      if (vendorsData.totalSpend > 0) {
        const expectedPercentage = (vendor.totalSpend / vendorsData.totalSpend) * 100;
        expect(Math.abs(vendor.percentageOfTotal - expectedPercentage)).toBeLessThan(0.01);
      }
    });
    
    // Verify average transaction amount
    vendorsData.vendors.forEach((vendor: any) => {
      if (vendor.transactionCount > 0) {
        const expectedAverage = vendor.totalSpend / vendor.transactionCount;
        expect(Math.abs(vendor.averageTransactionAmount - expectedAverage)).toBeLessThan(0.01);
      }
    });
  });

  test('Financial Health Score calculation should be logical', async ({ page }) => {
    await page.goto('/finance');
    
    // Get health score from page
    const healthScoreText = await page.locator('text=Financial Health Score').locator('..').locator('text=/[0-9]+/').first().textContent();
    const healthScore = parseInt(healthScoreText || '0');
    
    // Health score should be between 0 and 100
    expect(healthScore).toBeGreaterThanOrEqual(0);
    expect(healthScore).toBeLessThanOrEqual(100);
    
    // Get underlying metrics
    const metricsResponse = await page.request.get('/api/v1/bookkeeping/cash-balance');
    const cashData = await metricsResponse.json();
    
    const plResponse = await page.request.get('/api/v1/xero/reports/profit-loss');
    const plData = await plResponse.json();
    
    // Health score should be higher if cash balance is positive
    if (cashData.totalBalance > plData.expenses * 3) {
      expect(healthScore).toBeGreaterThanOrEqual(80);
    }
  });
});

test.describe('Cash Flow Forecast Business Logic Tests', () => {
  test('Cash flow forecast calculations should be accurate', async ({ page }) => {
    // Get forecast data
    const response = await page.request.get('/api/v1/cashflow/forecast?days=30&scenarios=true');
    const forecastData = await response.json();
    
    expect(forecastData.forecast).toBeInstanceOf(Array);
    expect(forecastData.summary).toBeDefined();
    
    // Verify forecast calculations
    forecastData.forecast.forEach((day: any, index: number) => {
      // Opening balance should match previous day's closing balance
      if (index > 0) {
        const previousDay = forecastData.forecast[index - 1];
        expect(day.openingBalance).toBe(previousDay.closingBalance);
      }
      
      // Verify daily calculations
      expect(day.inflows.total).toBe(
        day.inflows.fromInvoices + day.inflows.fromRepeating + day.inflows.fromOther
      );
      
      expect(day.outflows.total).toBe(
        day.outflows.toBills + 
        day.outflows.toRepeating + 
        day.outflows.toTaxes + 
        day.outflows.toPatterns + 
        day.outflows.toBudgets
      );
      
      // Closing balance = opening + inflows - outflows
      const expectedClosing = day.openingBalance + day.inflows.total - day.outflows.total;
      expect(Math.abs(day.closingBalance - expectedClosing)).toBeLessThan(0.01);
      
      // Confidence level should be between 0 and 1
      expect(day.confidenceLevel).toBeGreaterThanOrEqual(0);
      expect(day.confidenceLevel).toBeLessThanOrEqual(1);
      
      // Scenarios should be logical
      if (day.scenarios) {
        expect(day.scenarios.bestCase).toBeGreaterThanOrEqual(day.closingBalance);
        expect(day.scenarios.worstCase).toBeLessThanOrEqual(day.closingBalance);
      }
    });
    
    // Verify summary calculations
    const calculatedLowest = Math.min(...forecastData.forecast.map((f: any) => f.closingBalance));
    expect(forecastData.summary.lowestBalance).toBe(calculatedLowest);
    
    const calculatedTotalInflows = forecastData.forecast.reduce((sum: number, f: any) => sum + f.inflows.total, 0);
    expect(Math.abs(forecastData.summary.totalInflows - calculatedTotalInflows)).toBeLessThan(0.01);
    
    const calculatedTotalOutflows = forecastData.forecast.reduce((sum: number, f: any) => sum + f.outflows.total, 0);
    expect(Math.abs(forecastData.summary.totalOutflows - calculatedTotalOutflows)).toBeLessThan(0.01);
  });
});

test.describe('Transaction Processing Business Logic Tests', () => {
  test('Bank transaction reconciliation should work correctly', async ({ page }) => {
    // Get transactions from API
    const response = await page.request.get('/api/v1/bookkeeping/bank-transactions?page=1&pageSize=50');
    const transactionData = await response.json();
    
    expect(transactionData.transactions).toBeInstanceOf(Array);
    
    // Verify transaction properties
    transactionData.transactions.forEach((transaction: any) => {
      // Required fields
      expect(transaction.id).toBeTruthy();
      expect(transaction.date).toBeTruthy();
      expect(transaction.amount).toBeDefined();
      expect(transaction.type).toMatch(/^(SPEND|RECEIVE)$/);
      expect(transaction.status).toBeTruthy();
      expect(typeof transaction.isReconciled).toBe('boolean');
      
      // Amount should be positive
      expect(transaction.amount).toBeGreaterThanOrEqual(0);
      
      // Date should be valid
      const transactionDate = new Date(transaction.date);
      expect(transactionDate).toBeInstanceOf(Date);
      expect(transactionDate.getTime()).not.toBeNaN();
    });
    
    // Verify pagination
    if (transactionData.totalPages > 1) {
      expect(transactionData.transactions.length).toBeLessThanOrEqual(50);
    }
  });
});

test.describe('SOP Code Generation Business Logic Tests', () => {
  test('SOP code generation should follow proper format', async ({ page }) => {
    await page.goto('/bookkeeping/sop-generator');
    
    // Test SOP code format validation
    const testCases = [
      {
        year: '2025',
        chartOfAccount: '321 - Contract Salaries',
        serviceType: 'Contract - BUPA',
        expectedPattern: /FY25-321-CON-BUPA-\d{2}-[A-Z0-9]+/
      },
      {
        year: '2024',
        chartOfAccount: '381 - Postage',
        serviceType: 'Courier',
        expectedPattern: /FY24-381-COU-\d{2}-[A-Z0-9]+/
      }
    ];
    
    for (const testCase of testCases) {
      // Select options
      await page.selectOption('select[name="year"]', testCase.year);
      await page.selectOption('text=Chart of Account', testCase.chartOfAccount);
      await page.selectOption('text=Service Type', testCase.serviceType);
      
      // Click generate
      await page.getByRole('button', { name: 'Generate SOP Code' }).click();
      
      // Wait for result
      await expect(page.locator('text=Generated SOP Code')).toBeVisible();
      
      // Get generated code
      const generatedCode = await page.locator('.text-2xl.font-mono').textContent();
      
      // Verify format
      expect(generatedCode).toMatch(testCase.expectedPattern);
    }
  });
});
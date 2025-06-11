import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    const diagnostics: any = {
      tenant: tenant.tenantName,
      tests: []
    };
    
    // Test 1: Check raw API response
    diagnostics.tests.push({ name: 'Raw API Response Check' });
    try {
      const rawResponse = await xero.accountingApi.getBankTransactions(tenant.tenantId);
      diagnostics.tests[0].result = {
        hasBody: !!rawResponse.body,
        hasBankTransactions: !!rawResponse.body?.bankTransactions,
        transactionCount: rawResponse.body?.bankTransactions?.length || 0,
        response: JSON.stringify(rawResponse.body).substring(0, 500)
      };
    } catch (e: any) {
      diagnostics.tests[0].error = e.message;
    }
    
    // Test 2: Check with explicit parameters
    diagnostics.tests.push({ name: 'Explicit Parameters Test' });
    try {
      const response = await xero.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined, // ifModifiedSince
        undefined, // where
        undefined, // order
        100, // pageSize
        undefined, // unitdp
        1 // page
      );
      diagnostics.tests[1].result = {
        count: response.body?.bankTransactions?.length || 0,
        firstTx: response.body?.bankTransactions?.[0] ? {
          date: response.body.bankTransactions[0].date,
          account: response.body.bankTransactions[0].bankAccount?.name
        } : null
      };
    } catch (e: any) {
      diagnostics.tests[1].error = e.message;
    }
    
    // Test 3: Check specific date ranges
    diagnostics.tests.push({ name: 'Date Range Tests' });
    const dateTests = [];
    
    // Last 30 days
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    try {
      const resp = await xero.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined,
        `Date >= DateTime(${last30Days.toISOString().split('T')[0]}T00:00:00)`
      );
      dateTests.push({
        range: 'Last 30 days',
        count: resp.body?.bankTransactions?.length || 0
      });
    } catch (e: any) {
      dateTests.push({ range: 'Last 30 days', error: e.message });
    }
    
    // Last year
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    try {
      const resp = await xero.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined,
        `Date >= DateTime(${lastYear.toISOString().split('T')[0]}T00:00:00)`
      );
      dateTests.push({
        range: 'Last year',
        count: resp.body?.bankTransactions?.length || 0
      });
    } catch (e: any) {
      dateTests.push({ range: 'Last year', error: e.message });
    }
    
    diagnostics.tests[2].result = dateTests;
    
    // Test 4: Check pagination behavior
    diagnostics.tests.push({ name: 'Pagination Test' });
    const pageTests = [];
    for (let page = 1; page <= 5; page++) {
      try {
        const resp = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          undefined,
          undefined,
          100,
          undefined,
          page
        );
        pageTests.push({
          page,
          count: resp.body?.bankTransactions?.length || 0
        });
      } catch (e: any) {
        pageTests.push({ page, error: e.message });
      }
    }
    diagnostics.tests[3].result = pageTests;
    
    // Test 5: Check accounts and their individual transactions
    diagnostics.tests.push({ name: 'Per-Account Check' });
    const accountTests = [];
    
    const accountsResp = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    const accounts = accountsResp.body.accounts || [];
    
    for (const account of accounts.slice(0, 3)) { // Test first 3 accounts
      if (!account.accountID) continue;
      
      try {
        const resp = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          `BankAccount.AccountID=Guid("${account.accountID}")`
        );
        accountTests.push({
          account: account.name,
          currency: account.currencyCode,
          transactionCount: resp.body?.bankTransactions?.length || 0
        });
      } catch (e: any) {
        accountTests.push({
          account: account.name,
          error: e.message
        });
      }
    }
    diagnostics.tests[4].result = accountTests;
    
    return NextResponse.json(diagnostics);
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Diagnostic failed',
      message: error.message
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Mock a valid token for testing
    const mockToken = {
      access_token: 'mock_access_token_for_testing',
      refresh_token: 'mock_refresh_token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      token_type: 'Bearer',
      scope: 'accounting.transactions accounting.settings offline_access'
    };
    
    // Store the mock token
    const { storeTokenSet } = await import('@/lib/xero-client');
    await storeTokenSet(mockToken);
    
    return NextResponse.json({
      success: true,
      message: 'Mock token stored. Now try connecting to Xero again.'
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to set mock token',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const results: any[] = [];
  
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    results.push({
      step: 'Connected to Xero',
      tenant: tenant.tenantName,
      tenantId: tenant.tenantId
    });
    
    // Test 1: Get accounts first
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    const bankAccounts = accountsResponse.body.accounts || [];
    results.push({
      step: 'Bank accounts fetched',
      count: bankAccounts.length,
      accounts: bankAccounts.map(a => ({
        name: a.name,
        currency: a.currencyCode,
        accountID: a.accountID
      }))
    });
    
    // Test 2: Try different approaches to get transactions
    const approaches = [
      {
        name: 'No filters',
        params: {}
      },
      {
        name: 'With page 1',
        params: { page: 1 }
      },
      {
        name: 'With page 2',
        params: { page: 2 }
      },
      {
        name: 'With date order',
        params: { order: 'Date DESC' }
      },
      {
        name: 'With 100 per page',
        params: { pageSize: 100 }
      },
      {
        name: 'From specific date',
        params: { 
          where: `Date >= DateTime(2024-01-01T00:00:00)`,
          order: 'Date DESC'
        }
      },
      {
        name: 'From last 90 days',
        params: { 
          where: `Date >= DateTime(${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}T00:00:00)`,
          order: 'Date DESC'
        }
      }
    ];
    
    for (const approach of approaches) {
      try {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          (approach.params as any).ifModifiedSince,
          (approach.params as any).where,
          (approach.params as any).order,
          (approach.params as any).pageSize,
          undefined,
          (approach.params as any).page
        );
        
        results.push({
          approach: approach.name,
          success: true,
          transactionCount: response.body.bankTransactions?.length || 0,
          firstTransaction: response.body.bankTransactions?.[0] ? {
            date: response.body.bankTransactions[0].date,
            amount: response.body.bankTransactions[0].total,
            account: response.body.bankTransactions[0].bankAccount?.name
          } : null
        });
      } catch (error: any) {
        results.push({
          approach: approach.name,
          success: false,
          error: error.message
        });
      }
    }
    
    // Test 3: Try fetching from each account individually
    const accountResults = [];
    for (const account of bankAccounts.slice(0, 3)) { // Test first 3 accounts
      if (!account.accountID) continue;
      
      try {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          `BankAccount.AccountID=Guid("${account.accountID}")`,
          'Date DESC',
          100
        );
        
        accountResults.push({
          account: account.name,
          currency: account.currencyCode,
          transactionCount: response.body.bankTransactions?.length || 0
        });
      } catch (error: any) {
        accountResults.push({
          account: account.name,
          error: error.message
        });
      }
    }
    
    results.push({
      step: 'Per-account transaction fetch',
      accounts: accountResults
    });
    
    // Test 4: Check raw API response structure
    try {
      const rawResponse = await xero.accountingApi.getBankTransactions(tenant.tenantId);
      results.push({
        step: 'Raw API response check',
        hasBody: !!rawResponse.body,
        bodyKeys: rawResponse.body ? Object.keys(rawResponse.body) : [],
        hasBankTransactions: !!rawResponse.body?.bankTransactions,
        isArray: Array.isArray(rawResponse.body?.bankTransactions),
        raw: JSON.stringify(rawResponse.body).substring(0, 500) + '...'
      });
    } catch (error: any) {
      results.push({
        step: 'Raw API response check',
        error: error.message
      });
    }
    
    return NextResponse.json({
      success: true,
      results
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug sync failed',
      message: error.message,
      results
    }, { status: 500 });
  }
}
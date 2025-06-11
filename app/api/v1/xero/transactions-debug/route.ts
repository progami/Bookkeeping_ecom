import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    // Get the active tenant
    await xero.updateTenants();
    const activeTenant = xero.tenants[0];
    
    if (!activeTenant) {
      return NextResponse.json({ error: 'No active tenant' }, { status: 400 });
    }
    
    console.log('Debug: Fetching transactions for tenant:', activeTenant.tenantId);
    
    // Try multiple approaches to get transactions
    const results: any = {
      tenant: {
        id: activeTenant.tenantId,
        name: activeTenant.tenantName
      },
      accounts: [],
      transactions: {
        all: [],
        unreconciled: [],
        reconciled: []
      }
    };
    
    // 1. Get all bank accounts
    const accountsResponse = await xero.accountingApi.getAccounts(
      activeTenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    results.accounts = accountsResponse.body.accounts?.map(acc => ({
      id: acc.accountID,
      name: acc.name,
      code: acc.code,
      status: acc.status
    })) || [];
    
    console.log('Found bank accounts:', results.accounts.length);
    
    // 2. Try different transaction queries
    try {
      // Get ALL transactions
      const allTxResponse = await xero.accountingApi.getBankTransactions(
        activeTenant.tenantId
      );
      results.transactions.all = {
        count: allTxResponse.body.bankTransactions?.length || 0,
        sample: allTxResponse.body.bankTransactions?.slice(0, 3).map(tx => ({
          id: tx.bankTransactionID,
          date: tx.date,
          isReconciled: tx.isReconciled,
          status: tx.status,
          amount: tx.total,
          type: tx.type
        }))
      };
    } catch (err: any) {
      results.transactions.all = { error: err.message };
    }
    
    // 3. Try with specific status filter
    try {
      const unreconciledResponse = await xero.accountingApi.getBankTransactions(
        activeTenant.tenantId,
        undefined,
        'IsReconciled==false'
      );
      results.transactions.unreconciled = {
        count: unreconciledResponse.body.bankTransactions?.length || 0,
        sample: unreconciledResponse.body.bankTransactions?.slice(0, 3).map(tx => ({
          id: tx.bankTransactionID,
          date: tx.date,
          status: tx.status,
          amount: tx.total
        }))
      };
    } catch (err: any) {
      results.transactions.unreconciled = { error: err.message };
    }
    
    // 4. Try getting bank statement lines instead
    if (results.accounts.length > 0) {
      try {
        const bankStatementResponse = await xero.accountingApi.getBankTransactions(
          activeTenant.tenantId,
          undefined,
          `BankAccount.AccountID=Guid("${results.accounts[0].id}")`
        );
        results.bankStatements = {
          accountName: results.accounts[0].name,
          count: bankStatementResponse.body.bankTransactions?.length || 0
        };
      } catch (err: any) {
        results.bankStatements = { error: err.message };
      }
    }
    
    // 5. Check organization info
    const orgResponse = await xero.accountingApi.getOrganisations(activeTenant.tenantId);
    results.organization = {
      name: orgResponse.body.organisations?.[0]?.name,
      version: orgResponse.body.organisations?.[0]?.version,
      status: orgResponse.body.organisations?.[0]?.organisationStatus
    };
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Debug failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
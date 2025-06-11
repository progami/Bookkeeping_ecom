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
    
    const results: any = {
      tenant: {
        id: tenant.tenantId,
        name: tenant.tenantName
      },
      tests: []
    };
    
    // Test 1: Check if we're in Demo Company
    results.isDemo = tenant.tenantName?.toLowerCase().includes('demo');
    
    // Test 2: Get organization details
    try {
      const orgResponse = await xero.accountingApi.getOrganisations(tenant.tenantId);
      const org = orgResponse.body.organisations?.[0];
      results.organization = {
        name: org?.name,
        isDemoCompany: org?.isDemoCompany,
        organisationStatus: org?.organisationStatus,
        version: org?.version,
        shortCode: org?.shortCode
      };
    } catch (err: any) {
      results.organization = { error: err.message };
    }
    
    // Test 3: Try different transaction queries
    const queries = [
      { name: 'All transactions', where: undefined },
      { name: 'Last 30 days', where: `Date >= DateTime(${new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0]})` },
      { name: 'Unreconciled only', where: 'IsReconciled==false' },
      { name: 'Page 2', where: undefined, page: 2 },
      { name: 'Specific bank account', where: `BankAccount.AccountID=Guid("${results.accounts?.[0]?.id || '1062da11-898d-4d99-a585-826088d05039'}")` }
    ];
    
    for (const query of queries) {
      try {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          query.where,
          'Date DESC',
          100,
          undefined,
          query.page
        );
        
        results.tests.push({
          query: query.name,
          where: query.where,
          count: response.body.bankTransactions?.length || 0,
          firstTx: response.body.bankTransactions?.[0] ? {
            date: response.body.bankTransactions[0].date,
            amount: response.body.bankTransactions[0].total,
            status: response.body.bankTransactions[0].status
          } : null
        });
      } catch (err: any) {
        results.tests.push({
          query: query.name,
          error: err.message
        });
      }
    }
    
    // Test 4: Check invoices to see if there's data
    try {
      const invoicesResponse = await xero.accountingApi.getInvoices(
        tenant.tenantId,
        undefined,
        undefined,
        'Date DESC',
        undefined,
        undefined,
        undefined,
        undefined,
        1
      );
      results.invoices = {
        count: invoicesResponse.body.invoices?.length || 0,
        hasData: (invoicesResponse.body.invoices?.length || 0) > 0
      };
    } catch (err: any) {
      results.invoices = { error: err.message };
    }
    
    // Test 5: Get bank transfers
    try {
      const transfersResponse = await xero.accountingApi.getBankTransfers(tenant.tenantId);
      results.bankTransfers = {
        count: transfersResponse.body.bankTransfers?.length || 0
      };
    } catch (err: any) {
      results.bankTransfers = { error: err.message };
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Check failed',
      message: error.message,
      response: error.response?.data
    }, { status: 500 });
  }
}
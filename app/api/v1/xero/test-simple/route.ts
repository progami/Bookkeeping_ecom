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
    
    console.log('Testing with tenant:', tenant.tenantId);
    
    // Get raw response with minimal parameters
    const response = await xero.accountingApi.getBankTransactions(tenant.tenantId);
    
    // Return the raw response structure
    return NextResponse.json({
      success: true,
      tenant: tenant.tenantName,
      response: {
        hasBody: !!response.body,
        hasBankTransactions: !!response.body?.bankTransactions,
        transactionCount: response.body?.bankTransactions?.length || 0,
        firstTransaction: response.body?.bankTransactions?.[0] ? {
          id: response.body.bankTransactions[0].bankTransactionID,
          date: response.body.bankTransactions[0].date,
          status: response.body.bankTransactions[0].status,
          isReconciled: response.body.bankTransactions[0].isReconciled,
          type: response.body.bankTransactions[0].type,
          total: response.body.bankTransactions[0].total,
          bankAccount: response.body.bankTransactions[0].bankAccount?.name
        } : null,
        // Check if there's pagination info
        raw: response.body
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      response: error.response?.data
    }, { status: 500 });
  }
}
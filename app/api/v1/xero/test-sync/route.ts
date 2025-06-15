import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    console.log('[TEST-SYNC] Starting test sync...');
    
    const xero = await getXeroClient();
    console.log('[TEST-SYNC] Xero client obtained:', !!xero);
    
    if (!xero) {
      return NextResponse.json({
        error: 'Not connected to Xero',
        connected: false
      }, { status: 401 });
    }
    
    console.log('[TEST-SYNC] Updating tenants...');
    await xero.updateTenants();
    
    console.log('[TEST-SYNC] Tenants:', {
      count: xero.tenants?.length || 0,
      tenants: xero.tenants?.map(t => ({
        tenantId: t.tenantId,
        tenantName: t.tenantName,
        tenantType: t.tenantType
      }))
    });
    
    if (!xero.tenants || xero.tenants.length === 0) {
      return NextResponse.json({
        error: 'No Xero tenants found',
        connected: true,
        tenants: []
      }, { status: 400 });
    }
    
    const tenant = xero.tenants[0];
    
    // Try to fetch accounts as a test
    console.log('[TEST-SYNC] Fetching accounts for tenant:', tenant.tenantName);
    
    try {
      const accountsResponse = await xero.accountingApi.getAccounts(
        tenant.tenantId,
        undefined,
        'Type=="BANK"'
      );
      
      console.log('[TEST-SYNC] Accounts fetched:', {
        count: accountsResponse.body.accounts?.length || 0
      });
      
      return NextResponse.json({
        success: true,
        tenant: {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          tenantType: tenant.tenantType
        },
        bankAccounts: accountsResponse.body.accounts?.length || 0
      });
    } catch (apiError: any) {
      console.error('[TEST-SYNC] API Error:', apiError);
      return NextResponse.json({
        error: 'Failed to fetch accounts',
        message: apiError.message,
        tenant: {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName
        }
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('[TEST-SYNC] Error:', error);
    return NextResponse.json({
      error: 'Test sync failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Test Connection Endpoint ===');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    
    const xeroData = await getXeroClientWithTenant();
    
    if (!xeroData) {
      return NextResponse.json({
        connected: false,
        message: 'Failed to get Xero client',
        timestamp: new Date().toISOString()
      }, { status: 401 });
    }
    
    const { client, tenantId } = xeroData;
    
    // Try a simple API call
    try {
      const orgResponse = await client.accountingApi.getOrganisations(tenantId);
      const org = orgResponse.body.organisations?.[0];
      
      return NextResponse.json({
        connected: true,
        organization: {
          name: org?.name,
          version: org?.version,
          isDemoCompany: org?.isDemoCompany,
          organizationID: org?.organisationID
        },
        tenantId,
        timestamp: new Date().toISOString()
      });
    } catch (apiError: any) {
      console.error('API call error:', apiError);
      return NextResponse.json({
        connected: false,
        message: 'Client exists but API call failed',
        error: apiError.message,
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Test connection error:', error);
    return NextResponse.json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient, getStoredTokenSet } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    // Debug token storage
    const tokenSet = await getStoredTokenSet();
    const hasToken = !!tokenSet;
    
    const debugInfo = {
      hasStoredToken: hasToken,
      tokenDetails: hasToken ? {
        hasAccessToken: !!tokenSet?.access_token,
        hasRefreshToken: !!tokenSet?.refresh_token,
        expiresAt: tokenSet?.expires_at,
        expiresIn: tokenSet?.expires_in,
        scope: tokenSet?.scope
      } : null,
      cookies: request.cookies.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
    };
    
    // Try to get Xero client
    const xero = await getXeroClient();
    
    if (!xero) {
      return NextResponse.json({
        connected: false,
        debug: debugInfo,
        message: 'No Xero client available'
      });
    }
    
    // Try to get tenants
    try {
      await xero.updateTenants();
      const tenants = xero.tenants;
      
      return NextResponse.json({
        connected: true,
        tenants: tenants.map(t => ({
          id: t.tenantId,
          name: t.tenantName,
          type: t.tenantType
        })),
        debug: debugInfo
      });
    } catch (error: any) {
      return NextResponse.json({
        connected: false,
        error: error.message,
        debug: debugInfo
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getXeroClient, getStoredTokenSet, createXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  const debug: any = {
    timestamp: new Date().toISOString(),
    cookies: {},
    token: {},
    xeroClient: {},
    connection: {},
    error: null
  };

  try {
    // Check cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    debug.cookies = {
      count: allCookies.length,
      names: allCookies.map(c => c.name),
      hasXeroToken: allCookies.some(c => c.name === 'xero_token')
    };

    // Check stored token
    const tokenSet = await getStoredTokenSet();
    debug.token = {
      exists: !!tokenSet,
      hasAccessToken: !!tokenSet?.access_token,
      hasRefreshToken: !!tokenSet?.refresh_token,
      expiresAt: tokenSet?.expires_at,
      isExpired: tokenSet?.expires_at ? tokenSet.expires_at < Math.floor(Date.now() / 1000) : null,
      scope: tokenSet?.scope
    };

    // Try to get Xero client
    const xero = await getXeroClient();
    debug.xeroClient = {
      exists: !!xero,
      hasTokenSet: !!xero?.readTokenSet,
    };

    if (xero) {
      // Try to get tenants
      try {
        await xero.updateTenants();
        debug.connection = {
          connected: true,
          tenants: xero.tenants.map(t => ({
            id: t.tenantId,
            name: t.tenantName,
            type: t.tenantType
          }))
        };
      } catch (error: any) {
        debug.connection = {
          connected: false,
          error: error.message
        };
      }
    } else {
      debug.connection = {
        connected: false,
        error: 'No Xero client available'
      };
    }

    // Test direct API call if we have a token
    if (tokenSet?.access_token) {
      try {
        const testResponse = await fetch('https://api.xero.com/connections', {
          headers: {
            'Authorization': `Bearer ${tokenSet.access_token}`,
            'Accept': 'application/json'
          }
        });
        
        debug.directApiTest = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          ok: testResponse.ok
        };

        if (testResponse.ok) {
          const connections = await testResponse.json();
          debug.directApiTest.connections = connections;
        }
      } catch (error: any) {
        debug.directApiTest = {
          error: error.message
        };
      }
    }

  } catch (error: any) {
    debug.error = {
      message: error.message,
      stack: error.stack
    };
  }

  return NextResponse.json(debug);
}
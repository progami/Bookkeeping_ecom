import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStoredTokenSet } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Cookie Debug Endpoint ===');
    
    // Get all cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    console.log('All cookies:', allCookies.map(c => ({ name: c.name, valueLength: c.value?.length })));
    
    // Try to get xero_token specifically
    const xeroTokenCookie = cookieStore.get('xero_token');
    console.log('Xero token cookie exists:', !!xeroTokenCookie);
    
    if (xeroTokenCookie) {
      console.log('Cookie value length:', xeroTokenCookie.value?.length);
      try {
        const parsed = JSON.parse(xeroTokenCookie.value);
        console.log('Parsed cookie structure:', {
          hasAccessToken: !!parsed.access_token,
          hasRefreshToken: !!parsed.refresh_token,
          expiresAt: parsed.expires_at,
          tokenType: parsed.token_type
        });
      } catch (e) {
        console.error('Failed to parse cookie:', e);
      }
    }
    
    // Try using getStoredTokenSet
    const tokenSet = await getStoredTokenSet();
    console.log('Token from getStoredTokenSet:', !!tokenSet);
    
    // Check request headers
    const cookieHeader = request.headers.get('cookie');
    console.log('Cookie header:', cookieHeader);
    
    return NextResponse.json({
      allCookiesCount: allCookies.length,
      cookies: allCookies.map(c => ({ name: c.name, exists: true })),
      xeroTokenExists: !!xeroTokenCookie,
      tokenSetFromHelper: !!tokenSet,
      cookieHeader: cookieHeader,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
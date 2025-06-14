import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  console.log('[DebugCookies] ========== COOKIE DEBUG START ==========');
  
  try {
    // Get cookies from request
    const requestCookies = request.cookies.getAll();
    console.log('[DebugCookies] Request cookies:', requestCookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      valuePreview: c.value?.substring(0, 20) + '...'
    })));
    
    // Get cookies from Next.js cookies() function
    const cookieStore = await cookies();
    const nextCookies = cookieStore.getAll();
    console.log('[DebugCookies] Next.js cookies:', nextCookies.map(c => ({
      name: c.name,
      valueLength: c.value?.length || 0,
      valuePreview: c.value?.substring(0, 20) + '...'
    })));
    
    // Look specifically for xero_token
    const xeroTokenFromRequest = request.cookies.get('xero_token');
    const xeroTokenFromNext = cookieStore.get('xero_token');
    
    console.log('[DebugCookies] xero_token from request:', !!xeroTokenFromRequest);
    console.log('[DebugCookies] xero_token from Next.js:', !!xeroTokenFromNext);
    
    // Parse and validate xero_token if it exists
    let tokenData = null;
    let parseError = null;
    
    const tokenCookie = xeroTokenFromNext || xeroTokenFromRequest;
    if (tokenCookie?.value) {
      try {
        tokenData = JSON.parse(tokenCookie.value);
        console.log('[DebugCookies] Token parsed successfully');
      } catch (e: any) {
        parseError = e.message;
        console.error('[DebugCookies] Failed to parse token:', e);
      }
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        appUrl: process.env.NEXT_PUBLIC_APP_URL,
        cookieDomain: process.env.COOKIE_DOMAIN || 'not set'
      },
      cookies: {
        fromRequest: requestCookies.map(c => ({
          name: c.name,
          exists: true,
          length: c.value?.length || 0
        })),
        fromNextjs: nextCookies.map(c => ({
          name: c.name,
          exists: true,
          length: c.value?.length || 0,
          attributes: {
            path: c.path
          }
        }))
      },
      xeroToken: {
        existsInRequest: !!xeroTokenFromRequest,
        existsInNextjs: !!xeroTokenFromNext,
        parsed: tokenData ? {
          hasAccessToken: !!tokenData.access_token,
          hasRefreshToken: !!tokenData.refresh_token,
          expiresAt: tokenData.expires_at,
          tokenType: tokenData.token_type,
          scope: tokenData.scope
        } : null,
        parseError
      },
      headers: {
        cookie: request.headers.get('cookie'),
        host: request.headers.get('host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer')
      }
    };
    
    console.log('[DebugCookies] ========== COOKIE DEBUG END ==========');
    
    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('[DebugCookies] Error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}

// Test endpoint to set a cookie
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name = 'test_cookie', value = 'test_value' } = body;
    
    const response = NextResponse.json({ 
      message: 'Cookie set',
      cookie: { name, value }
    });
    
    response.cookies.set(name, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'),
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour
      path: '/'
    });
    
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
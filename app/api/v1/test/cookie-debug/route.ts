import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    
    // Get specific xero_token cookie
    const xeroToken = cookieStore.get('xero_token');
    
    // Check request headers
    const cookieHeader = request.headers.get('cookie');
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      cookieHeader: cookieHeader || 'No cookie header',
      allCookies: allCookies.map(c => ({
        name: c.name,
        valueLength: c.value?.length || 0,
        // Show first 50 chars of value for debugging (redacted for security)
        valuePreview: c.value ? `${c.value.substring(0, 50)}...` : 'empty'
      })),
      xeroTokenCookie: xeroToken ? {
        exists: true,
        valueLength: xeroToken.value?.length || 0,
        // Try to parse to check if it's valid JSON
        isValidJson: (() => {
          try {
            JSON.parse(xeroToken.value);
            return true;
          } catch {
            return false;
          }
        })()
      } : {
        exists: false
      },
      nodeEnv: process.env.NODE_ENV,
      secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https'),
      cookieDomain: process.env.COOKIE_DOMAIN || 'not set'
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Cookie debug failed',
      message: error.message
    }, { status: 500 });
  }
}

// Set a test cookie
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Set a test cookie with same options as xero_token
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      random: Math.random()
    };
    
    const isSecure = process.env.NODE_ENV === 'production' || 
                    (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('https://'));
    
    cookieStore.set('test_cookie', JSON.stringify(testData), {
      httpOnly: true,
      secure: !!isSecure, // Ensure boolean type
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });
    
    return NextResponse.json({
      message: 'Test cookie set',
      data: testData,
      cookieOptions: {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to set test cookie',
      message: error.message
    }, { status: 500 });
  }
}
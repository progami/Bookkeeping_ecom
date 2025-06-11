import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeTokenSet } from '@/lib/xero-client';

export async function POST(request: NextRequest) {
  try {
    // Create a test token that mimics a real Xero token
    const testToken = {
      access_token: 'test_access_token_' + Date.now(),
      refresh_token: 'test_refresh_token_' + Date.now(),
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'accounting.transactions accounting.settings offline_access'
    };
    
    console.log('Attempting to store test token:', testToken);
    
    // Try to store using the same method as the callback
    await storeTokenSet(testToken);
    
    // Also try direct cookie set
    const cookieStore = await cookies();
    const tokenString = JSON.stringify(testToken);
    
    // Try different cookie configurations
    const cookieConfigs = [
      {
        name: 'xero_token',
        value: tokenString,
        httpOnly: true,
        secure: false,
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      },
      {
        name: 'xero_token_test',
        value: tokenString,
        httpOnly: false,
        secure: false,
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
      }
    ];
    
    for (const config of cookieConfigs) {
      cookieStore.set(config.name, config.value, {
        httpOnly: config.httpOnly,
        secure: config.secure,
        sameSite: config.sameSite,
        maxAge: config.maxAge,
        path: config.path
      });
    }
    
    // Verify what cookies were set
    const allCookies = cookieStore.getAll();
    
    return NextResponse.json({
      success: true,
      message: 'Test token stored',
      token: {
        expires_at: testToken.expires_at,
        has_access_token: !!testToken.access_token
      },
      cookies: {
        count: allCookies.length,
        names: allCookies.map(c => c.name)
      }
    });
  } catch (error: any) {
    console.error('Error storing test token:', error);
    return NextResponse.json({
      error: 'Failed to store test token',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const xeroToken = cookieStore.get('xero_token');
    const xeroTokenTest = cookieStore.get('xero_token_test');
    
    // Try to parse tokens
    let parsedToken = null;
    let parseError = null;
    
    if (xeroToken) {
      try {
        parsedToken = JSON.parse(xeroToken.value);
      } catch (e: any) {
        parseError = e.message;
      }
    }
    
    return NextResponse.json({
      cookies: {
        all: allCookies.map(c => ({
          name: c.name,
          hasValue: !!c.value,
          length: c.value?.length || 0
        })),
        xero_token: {
          exists: !!xeroToken,
          length: xeroToken?.value?.length || 0,
          parsed: parsedToken,
          parseError
        },
        xero_token_test: {
          exists: !!xeroTokenTest,
          length: xeroTokenTest?.value?.length || 0
        }
      },
      headers: Object.fromEntries(request.headers.entries())
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check cookies',
      message: error.message
    }, { status: 500 });
  }
}
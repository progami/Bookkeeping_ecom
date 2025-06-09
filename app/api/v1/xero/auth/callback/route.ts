import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
  
  // Handle errors
  if (error) {
    console.error('Xero OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=${encodeURIComponent(errorDescription || error)}`);
  }
  
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=no_code`);
  }
  
  // Verify state (CSRF protection)
  const storedState = request.cookies.get('xero_state')?.value;
  if (state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=invalid_state`);
  }
  
  try {
    // Exchange code for token
    const xero = createXeroClient();
    await xero.initialize();
    const tokenSet = await xero.apiCallback(code);
    
    // Store token in secure cookie
    await storeTokenSet(tokenSet);
    
    // Clear state cookie
    const response = NextResponse.redirect(`${baseUrl}/bookkeeping?connected=true`);
    response.cookies.delete('xero_state');
    
    return response;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=token_exchange_failed`);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';
import { stateStore, cleanupStates, generatePKCEPair } from '@/lib/oauth-state';
import crypto from 'crypto';
import { structuredLogger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiter';

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    // Clean up old states
    cleanupStates();
    
    // Get return URL from query params or referrer
    const searchParams = request.nextUrl.searchParams;
    const returnUrl = searchParams.get('returnUrl') || request.headers.get('referer')?.replace(request.nextUrl.origin, '') || '/finance';
    
    // Generate a cryptographically secure random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Generate PKCE pair
    const { codeVerifier, codeChallenge } = generatePKCEPair();
    
    // Store state and PKCE in memory with return URL
    stateStore.set(state, { 
      timestamp: Date.now(),
      codeVerifier,
      codeChallenge,
      returnUrl
    });
    
    // Get the authorization URL with PKCE
    const authUrl = await getAuthUrl(state, codeChallenge);
    
    // Also try to store state in cookie as backup
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('xero_state', state, {
      httpOnly: true,
      secure: true, // Always use secure in development with HTTPS
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    // Store PKCE code_verifier in a separate cookie as backup
    response.cookies.set('xero_pkce', codeVerifier, {
      httpOnly: true,
      secure: true, // Always use secure in development with HTTPS
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    structuredLogger.info('OAuth initiated', {
      component: 'xero-auth',
      stateLength: state.length,
      statesInMemory: stateStore.size
    });
    
    return response;
  } catch (error: any) {
    structuredLogger.error('Error initiating Xero OAuth', error, {
      component: 'xero-auth',
      errorCode: error.code,
      errorName: error.name
    });
    
    // Return a more detailed error response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    const errorMessage = encodeURIComponent(error.message || 'auth_initialization_failed');
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=${errorMessage}&details=${encodeURIComponent(error.stack || 'No stack trace')}`);
  }
});
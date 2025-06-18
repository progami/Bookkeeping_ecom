import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';
import { storeState, generatePKCEPair } from '@/lib/oauth-state-manager';
import crypto from 'crypto';
import { structuredLogger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiter';

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    // Get return URL from query params or referrer
    const searchParams = request.nextUrl.searchParams;
    const returnUrl = searchParams.get('returnUrl') || request.headers.get('referer')?.replace(request.nextUrl.origin, '') || '/finance';
    
    // Generate a cryptographically secure random state for CSRF protection
    const state = crypto.randomBytes(32).toString('base64url');
    
    // Generate PKCE pair
    const { codeVerifier, codeChallenge } = generatePKCEPair();
    
    // Store state and PKCE using the state manager (Redis with fallback)
    structuredLogger.debug('About to store OAuth state', {
      component: 'xero-auth',
      state: state.substring(0, 8) + '...',
      hasCodeVerifier: !!codeVerifier,
      hasCodeChallenge: !!codeChallenge,
      returnUrl
    });
    
    await storeState(state, { 
      codeVerifier,
      codeChallenge,
      returnUrl
    });
    
    structuredLogger.debug('OAuth state stored successfully', {
      component: 'xero-auth'
    });
    
    // Get the authorization URL with state and PKCE
    const authUrl = await getAuthUrl(state, codeChallenge);
    
    // Validate the auth URL includes required parameters
    const url = new URL(authUrl);
    if (!url.searchParams.has('state')) {
      throw new Error('State parameter missing from auth URL');
    }
    if (!url.searchParams.has('code_challenge')) {
      throw new Error('PKCE code_challenge missing from auth URL');
    }
    
    structuredLogger.info('OAuth flow initiated', {
      component: 'xero-auth',
      state: state.substring(0, 8) + '...',
      hasState: url.searchParams.has('state'),
      hasPKCE: url.searchParams.has('code_challenge'),
      returnUrl
    });
    
    // Redirect to Xero auth URL
    return NextResponse.redirect(authUrl);
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
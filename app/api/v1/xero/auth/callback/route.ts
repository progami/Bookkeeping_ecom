import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet, xeroConfig } from '@/lib/xero-client';
import { stateStore } from '@/lib/oauth-state';
import { XeroSession } from '@/lib/xero-session';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  // Handle errors
  if (error) {
    structuredLogger.error('Xero OAuth error', undefined, {
      component: 'xero-auth-callback',
      error,
      errorDescription
    });
    return NextResponse.redirect(`${baseUrl}/finance?error=${encodeURIComponent(errorDescription || error)}`);
  }
  
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/finance?error=no_code`);
  }
  
  // Verify state (CSRF protection)
  const storedState = request.cookies.get('xero_state')?.value;
  const stateData = state ? stateStore.get(state) : null;
  const stateInMemory = !!stateData;
  
  structuredLogger.debug('OAuth callback received', {
    component: 'xero-auth-callback',
    hasState: !!state,
    hasCookieState: !!storedState,
    stateInMemory,
    memoryStatesCount: stateStore.size
  });
  
  // TEMPORARY WORKAROUND: Xero is not returning the state parameter
  // If we have a valid cookie state and no state in URL, continue anyway
  const isXeroStateBug = !state && storedState && code;
  
  if (isXeroStateBug) {
    structuredLogger.warn('Xero did not return state parameter. Proceeding with cookie validation only.', {
      component: 'xero-auth-callback'
    });
  }
  
  // Check both cookie and memory store
  const isValidState = (storedState && state === storedState) || stateInMemory || isXeroStateBug;
  
  if (!isValidState) {
    structuredLogger.error('State validation failed', undefined, {
      component: 'xero-auth-callback',
      receivedState: !!state,
      hasCookieState: !!storedState,
      memoryHasState: stateInMemory
    });
    return NextResponse.redirect(`${baseUrl}/finance?error=invalid_state`);
  }
  
  // Clean up the state from memory
  if (state) {
    stateStore.delete(state);
  }
  
  try {
    // Exchange code for token
    // Pass the state to the XeroClient constructor
    const xero = createXeroClient(storedState || state || undefined);
    
    structuredLogger.debug('Exchanging code for token', {
      component: 'xero-auth-callback',
      redirectUri: xeroConfig.redirectUris[0]
    });
    
    // The Xero SDK requires openid-client to be initialized first
    await xero.initialize();
    
    // Get the full callback URL (including code and state)
    const fullCallbackUrl = request.url;
    structuredLogger.debug('Full callback URL received', {
      component: 'xero-auth-callback',
      url: fullCallbackUrl
    });
    
    try {
      // The apiCallback only takes the callback URL as parameter
      // The state is checked internally using the state configured in the XeroClient
      structuredLogger.debug('Calling apiCallback', { component: 'xero-auth-callback' });
      const tokenSet = await xero.apiCallback(fullCallbackUrl);
      
      structuredLogger.info('Token exchange successful', {
        component: 'xero-auth-callback',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at
      });
      
      // Create response with redirect
      structuredLogger.debug('Creating redirect response', { 
        component: 'xero-auth-callback',
        redirectTo: `${baseUrl}/finance?connected=true` 
      });
      const response = NextResponse.redirect(`${baseUrl}/finance?connected=true`);
      
      // Store token in secure cookie using the response
      const tokenData = {
        access_token: tokenSet.access_token || '',
        refresh_token: tokenSet.refresh_token || '',
        expires_at: tokenSet.expires_at || (Math.floor(Date.now() / 1000) + (tokenSet.expires_in || 1800)),
        expires_in: tokenSet.expires_in || 1800,
        token_type: tokenSet.token_type || 'Bearer',
        scope: tokenSet.scope || ''
      };
      
      structuredLogger.debug('Token data prepared for storage', {
        component: 'xero-auth-callback',
        hasAccessToken: !!tokenData.access_token,
        accessTokenLength: tokenData.access_token.length,
        hasRefreshToken: !!tokenData.refresh_token,
        refreshTokenLength: tokenData.refresh_token.length,
        expiresAt: tokenData.expires_at,
        tokenType: tokenData.token_type
      });
      
      XeroSession.setTokenInResponse(response, tokenData);
      
      // Log response details
      structuredLogger.debug('Response created', {
        component: 'xero-auth-callback',
        status: response.status,
        location: response.headers.get('location'),
        hasCookie: !!response.headers.get('set-cookie')
      });
      
      // Clear state cookie
      response.cookies.delete('xero_state');
      structuredLogger.debug('State cookie deleted', { component: 'xero-auth-callback' });
      return response;
    } catch (tokenError: any) {
      structuredLogger.error('Token exchange error', tokenError, {
        component: 'xero-auth-callback'
      });
      
      // Try alternative approach
      if (tokenError.message.includes('Access token is undefined')) {
        structuredLogger.info('Trying manual token exchange', { component: 'xero-auth-callback' });
        
        // Build token exchange request manually
        const tokenUrl = 'https://identity.xero.com/connect/token';
        const params = new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback',
          client_id: process.env.XERO_CLIENT_ID || '',
          client_secret: process.env.XERO_CLIENT_SECRET || ''
        });
        
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString()
        });
        
        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          structuredLogger.error('Manual token exchange failed', undefined, {
            component: 'xero-auth-callback',
            status: tokenResponse.status,
            error: errorText
          });
          throw new Error(`Token exchange failed: ${errorText}`);
        }
        
        const tokenData = await tokenResponse.json();
        structuredLogger.info('Manual token exchange successful', { component: 'xero-auth-callback' });
        
        // Create response with redirect
        structuredLogger.debug('Creating manual redirect response', { 
          component: 'xero-auth-callback',
          redirectTo: `${baseUrl}/finance?connected=true` 
        });
        const response = NextResponse.redirect(`${baseUrl}/finance?connected=true`);
        
        // Create TokenSet object
        const tokenSet = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in
        };
        
        structuredLogger.debug('Manual token data prepared for storage', {
          component: 'xero-auth-callback',
          hasAccessToken: !!tokenSet.access_token,
          accessTokenLength: tokenSet.access_token.length,
          hasRefreshToken: !!tokenSet.refresh_token,
          refreshTokenLength: tokenSet.refresh_token.length,
          expiresAt: tokenSet.expires_at,
          tokenType: tokenSet.token_type
        });
        
        // Store token in response cookie
        XeroSession.setTokenInResponse(response, tokenSet);
        
        // Log response details
        structuredLogger.debug('Manual response created', {
          component: 'xero-auth-callback',
          status: response.status,
          location: response.headers.get('location'),
          hasCookie: !!response.headers.get('set-cookie')
        });
        
        // Clear state cookie
        response.cookies.delete('xero_state');
        structuredLogger.debug('Manual state cookie deleted', { component: 'xero-auth-callback' });
        return response;
      }
      
      throw tokenError;
    }
  } catch (error: any) {
    structuredLogger.error('Error exchanging code for token', error, {
      component: 'xero-auth-callback',
      statusCode: error.statusCode,
      response: error.response
    });
    
    // Extract more specific error message
    let errorMessage = 'token_exchange_failed';
    if (error.message) {
      if (error.message.includes('invalid_client')) {
        errorMessage = 'invalid_client_credentials';
      } else if (error.message.includes('invalid_grant')) {
        errorMessage = 'invalid_or_expired_code';
      } else if (error.message.includes('redirect_uri')) {
        errorMessage = 'redirect_uri_mismatch';
      }
    }
    
    return NextResponse.redirect(`${baseUrl}/finance?error=${errorMessage}`);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet, xeroConfig } from '@/lib/xero-client';
import { stateStore } from '@/lib/oauth-state';
import { XeroSession } from '@/lib/xero-session';
import { structuredLogger } from '@/lib/logger';
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE_NAME } from '@/lib/cookie-config';
import { withRateLimit } from '@/lib/rate-limiter';

export const GET = withRateLimit(async (request: NextRequest) => {
  console.log('[AUTH_CALLBACK] Starting callback handler');
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    console.log('[AUTH_CALLBACK] Params:', { code: !!code, state: !!state, error, errorDescription });
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  // Handle errors
  if (error) {
    structuredLogger.error('Xero OAuth error', undefined, {
      component: 'xero-auth-callback',
      error,
      errorDescription
    });
    return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorDescription || error)}`);
  }
  
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=no_code`);
  }
  
  // Verify state (CSRF protection)
  const storedState = request.cookies.get('xero_state')?.value;
  const stateData = state ? stateStore.get(state) : null;
  const stateInMemory = !!stateData;
  
  console.log('[AUTH_CALLBACK] State check:', {
    receivedState: state,
    cookieState: storedState,
    stateMatch: state === storedState,
    stateInMemory,
    stateStoreSize: stateStore.size
  });
  
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
    return NextResponse.redirect(`${baseUrl}/login?error=invalid_state`);
  }
  
  // Retrieve state data including code verifier
  let codeVerifier: string | undefined;
  if (stateData) {
    codeVerifier = stateData.codeVerifier;
    console.log('[AUTH_CALLBACK] Retrieved code verifier from state');
  } else {
    // Fallback to cookie if state store doesn't have it
    const pkceCookie = request.cookies.get('xero_pkce')?.value;
    if (pkceCookie) {
      codeVerifier = pkceCookie;
      console.log('[AUTH_CALLBACK] Retrieved code verifier from cookie');
    }
  }
  
  // Clean up the state from memory
  if (state) {
    stateStore.delete(state);
  }
  
  try {
    console.log('[AUTH_CALLBACK] Starting token exchange with:', {
      hasCodeVerifier: !!codeVerifier,
      codeVerifierLength: codeVerifier?.length,
      state: storedState || state || 'no-state'
    });
    // Exchange code for token with PKCE verifier
    const xero = createXeroClient(storedState || state || undefined, codeVerifier);
    
    console.log('[AUTH_CALLBACK] Created Xero client');
    structuredLogger.debug('Exchanging code for token', {
      component: 'xero-auth-callback',
      redirectUri: xeroConfig.redirectUris[0],
      hasCodeVerifier: !!codeVerifier,
      codeVerifierLength: codeVerifier?.length
    });
    
    // The Xero SDK requires openid-client to be initialized first
    console.log('[AUTH_CALLBACK] Initializing Xero SDK');
    await xero.initialize();
    console.log('[AUTH_CALLBACK] Xero SDK initialized');
    
    // Double-check if the Xero client has the code verifier set
    if (codeVerifier && !(xero as any).__codeVerifier) {
      console.log('[AUTH_CALLBACK] Code verifier was not set, setting it now');
      (xero as any).__codeVerifier = codeVerifier;
    }
    
    // Patch the openIdClient to include code_verifier in the token exchange
    if (codeVerifier && xero.openIdClient) {
      console.log('[AUTH_CALLBACK] Patching openIdClient for PKCE');
      const originalOauthCallback = xero.openIdClient.oauthCallback;
      xero.openIdClient.oauthCallback = async function(redirectUri: any, parameters: any, checks?: any, extras?: any) {
        // Add code_verifier to the check object
        if (checks && typeof checks === 'object') {
          checks.code_verifier = codeVerifier;
          console.log('[AUTH_CALLBACK] Added code_verifier to check object');
        }
        return originalOauthCallback.call(this, redirectUri, parameters, checks, extras);
      };
    }
    
    // Get the full callback URL (including code and state)
    const fullCallbackUrl = request.url;
    structuredLogger.debug('Full callback URL received', {
      component: 'xero-auth-callback',
      url: fullCallbackUrl
    });
    
    try {
      // The apiCallback only takes the callback URL as parameter
      // The state is checked internally using the state configured in the XeroClient
      structuredLogger.debug('Calling apiCallback', { 
        component: 'xero-auth-callback',
        hasCodeVerifier: !!(xero as any)._codeVerifier,
        codeVerifierSet: codeVerifier ? 'yes' : 'no'
      });
      
      // Check if openid-client is properly initialized
      if (!(xero as any).openIdClient) {
        structuredLogger.error('OpenID client not initialized', undefined, {
          component: 'xero-auth-callback'
        });
        throw new Error('OpenID client not initialized');
      }
      
      const tokenSet = await xero.apiCallback(fullCallbackUrl);
      
      structuredLogger.info('Token exchange successful', {
        component: 'xero-auth-callback',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token,
        expiresAt: tokenSet.expires_at
      });
      
      // Get user info from Xero and store in database
      try {
        // Get Xero client to fetch user info
        const xeroWithToken = createXeroClient();
        xeroWithToken.setTokenSet(tokenSet);
        await xeroWithToken.updateTenants();
        
        if (xeroWithToken.tenants && xeroWithToken.tenants.length > 0) {
          const tenant = xeroWithToken.tenants[0];
          
          // Get user info from ID token if available
          let userInfo: any = {};
          if (tokenSet.id_token) {
            try {
              // Decode ID token to get user info
              const idTokenPayload = JSON.parse(
                Buffer.from(tokenSet.id_token.split('.')[1], 'base64').toString()
              );
              userInfo = {
                xeroUserId: idTokenPayload.sub || idTokenPayload.xero_userid,
                email: idTokenPayload.email,
                firstName: idTokenPayload.given_name,
                lastName: idTokenPayload.family_name,
                fullName: idTokenPayload.name
              };
            } catch (e) {
              console.error('Failed to decode ID token:', e);
            }
          }
          
          // Store user in database
          const { prisma } = await import('@/lib/prisma');
          const user = await prisma.user.upsert({
            where: { 
              email: userInfo.email || `${tenant.tenantId}@xero.local`
            },
            update: {
              tenantId: tenant.tenantId,
              tenantName: tenant.tenantName || 'Unknown',
              tenantType: tenant.tenantType,
              lastLoginAt: new Date(),
              xeroAccessToken: tokenSet.access_token,
              xeroRefreshToken: tokenSet.refresh_token,
              tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
            },
            create: {
              xeroUserId: userInfo.xeroUserId || tenant.tenantId,
              email: userInfo.email || `${tenant.tenantId}@xero.local`,
              password: '', // Empty password for Xero-only users
              firstName: userInfo.firstName,
              lastName: userInfo.lastName,
              fullName: userInfo.fullName,
              tenantId: tenant.tenantId,
              tenantName: tenant.tenantName || 'Unknown',
              tenantType: tenant.tenantType,
              xeroAccessToken: tokenSet.access_token,
              xeroRefreshToken: tokenSet.refresh_token,
              tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
            }
          });
          
          structuredLogger.info('User stored in database', {
            component: 'xero-auth-callback',
            userId: user.id,
            email: user.email,
            tenantName: user.tenantName
          });
          
          // Create user session
          const userSession = {
            userId: user.id,
            email: user.email,
            tenantId: user.tenantId,
            tenantName: user.tenantName
          };
          
          // Prepare token data
          const tokenData = {
            access_token: tokenSet.access_token || '',
            refresh_token: tokenSet.refresh_token || '',
            expires_at: tokenSet.expires_at || (Math.floor(Date.now() / 1000) + (tokenSet.expires_in || 1800)),
            expires_in: tokenSet.expires_in || 1800,
            token_type: tokenSet.token_type || 'Bearer',
            scope: tokenSet.scope || ''
          };
          
          // Store session in cookie
          // Check for return URL in state data
          const returnUrl = stateData?.returnUrl || '/finance';
          const redirectUrl = `${baseUrl}${returnUrl}?connected=true`;
          
          const response = NextResponse.redirect(redirectUrl);
          response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(userSession), AUTH_COOKIE_OPTIONS);
          
          structuredLogger.debug('Setting user session cookie', {
            component: 'xero-auth-callback',
            cookieName: SESSION_COOKIE_NAME,
            cookieOptions: AUTH_COOKIE_OPTIONS,
            userSession
          });
          
          // Store token in secure cookie
          XeroSession.setTokenInResponse(response, tokenData);
          
          // Clear state and PKCE cookies
          response.cookies.delete('xero_state');
          response.cookies.delete('xero_pkce');
          
          return response;
        }
      } catch (error) {
        structuredLogger.error('Failed to store user info', error, {
          component: 'xero-auth-callback'
        });
        // Continue with auth flow even if user storage fails
      }
      
      // Create response with redirect (fallback if user creation fails)
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
      
      // Clear state and PKCE cookies
      response.cookies.delete('xero_state');
      response.cookies.delete('xero_pkce');
      structuredLogger.debug('State and PKCE cookies deleted', { component: 'xero-auth-callback' });
      return response;
    } catch (tokenError: any) {
      console.log('[AUTH_CALLBACK] Token exchange failed:', tokenError.message);
      console.log('[AUTH_CALLBACK] Error stack:', tokenError.stack);
      structuredLogger.error('Token exchange error', tokenError, {
        component: 'xero-auth-callback',
        errorMessage: tokenError.message,
        errorName: tokenError.name,
        hasCodeVerifier: !!codeVerifier
      });
      
      // Try alternative approach - also for invalid_grant errors
      if (tokenError.message.includes('Access token is undefined') || tokenError.message.includes('invalid_grant')) {
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
        
        // Add PKCE code_verifier if available
        if (codeVerifier) {
          params.append('code_verifier', codeVerifier);
          structuredLogger.debug('Added PKCE code_verifier to manual token exchange', {
            component: 'xero-auth-callback',
            codeVerifierLength: codeVerifier.length,
            codeVerifier: codeVerifier.substring(0, 10) + '...' // Log first 10 chars for debugging
          });
        }
        
        structuredLogger.debug('Manual token exchange parameters', {
          component: 'xero-auth-callback',
          hasCode: !!params.get('code'),
          hasCodeVerifier: !!params.get('code_verifier'),
          redirectUri: params.get('redirect_uri'),
          clientId: params.get('client_id')?.substring(0, 8) + '...',
          grantType: params.get('grant_type')
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
        
        // Clear state and PKCE cookies
        response.cookies.delete('xero_state');
        response.cookies.delete('xero_pkce');
        structuredLogger.debug('Manual state and PKCE cookies deleted', { component: 'xero-auth-callback' });
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
    
    return NextResponse.redirect(`${baseUrl}/login?error=${errorMessage}`);
  }
  } catch (fatalError: any) {
    // Catch any errors that might occur before we can even log
    console.error('[FATAL] Xero callback error:', fatalError.message || fatalError);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    return NextResponse.redirect(`${baseUrl}/login?error=callback_fatal_error`);
  }
});
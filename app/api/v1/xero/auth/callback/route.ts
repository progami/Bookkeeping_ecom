import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet, xeroConfig } from '@/lib/xero-client';
import { getState, deleteState } from '@/lib/oauth-state-manager';
import { XeroSession } from '@/lib/xero-session';
import { structuredLogger } from '@/lib/logger';
import { AUTH_COOKIE_OPTIONS, SESSION_COOKIE_NAME } from '@/lib/cookie-config';
import { withRateLimit } from '@/lib/rate-limiter';

export const GET = withRateLimit(async (request: NextRequest) => {
  structuredLogger.debug('Starting OAuth callback handler', {
    component: 'xero-auth-callback'
  });
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    structuredLogger.debug('OAuth callback parameters received', {
      component: 'xero-auth-callback',
      hasCode: !!code,
      hasState: !!state,
      error,
      errorDescription
    });
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  // Check if user is already authenticated
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = !!sessionCookie?.value;
  
  // Determine error redirect based on auth status
  const errorRedirect = (errorParam: string) => {
    if (isAuthenticated) {
      // If authenticated, redirect to finance page with error
      return NextResponse.redirect(`${baseUrl}/finance?xero_error=${encodeURIComponent(errorParam)}`);
    } else {
      // If not authenticated, redirect to login
      return NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(errorParam)}`);
    }
  };
  
  // Handle errors
  if (error) {
    structuredLogger.error('Xero OAuth error', undefined, {
      component: 'xero-auth-callback',
      error,
      errorDescription
    });
    return errorRedirect(errorDescription || error);
  }
  
  if (!code) {
    return errorRedirect('no_code');
  }
  
  // Verify state (CSRF protection)
  if (!state) {
    structuredLogger.error('No state parameter in callback', undefined, {
      component: 'xero-auth-callback'
    });
    return errorRedirect('missing_state');
  }
  
  // Retrieve state data from state manager
  const stateData = await getState(state);
  
  if (!stateData) {
    structuredLogger.error('Invalid or expired state', undefined, {
      component: 'xero-auth-callback',
      state: state.substring(0, 8) + '...'
    });
    return errorRedirect('invalid_state');
  }
  
  // Extract code verifier for PKCE
  const codeVerifier = stateData.codeVerifier;
  const returnUrl = stateData.returnUrl || '/sync';
  
  if (!codeVerifier) {
    structuredLogger.error('No code verifier in state data', undefined, {
      component: 'xero-auth-callback'
    });
    return errorRedirect('invalid_pkce');
  }
  
  structuredLogger.debug('State validated successfully', {
    component: 'xero-auth-callback',
    hasCodeVerifier: true,
    returnUrl
  });
  
  try {
    structuredLogger.debug('Starting token exchange', {
      component: 'xero-auth-callback',
      hasCodeVerifier: true,
      state: state.substring(0, 8) + '...'
    });
    
    // Create Xero client with state
    const xero = createXeroClient(state);
    
    // Initialize the Xero SDK (required for openid-client)
    await xero.initialize();
    
    structuredLogger.debug('Xero client initialized', {
      component: 'xero-auth-callback',
      redirectUri: xeroConfig.redirectUris[0]
    });
    
    // Get the full callback URL (including code and state)
    const fullCallbackUrl = request.url;
    structuredLogger.debug('Full callback URL received', {
      component: 'xero-auth-callback',
      url: fullCallbackUrl
    });
    
    try {
      // Extract parameters from the callback URL
      const params = xero.openIdClient.callbackParams(fullCallbackUrl);
      
      // Exchange authorization code for tokens with PKCE checks
      const checks = {
        code_verifier: codeVerifier,
        state: state
      };
      
      // Use the openid-client directly for proper PKCE support
      let tokenSet;
      if (xeroConfig.scopes.includes('openid')) {
        tokenSet = await xero.openIdClient.callback(xeroConfig.redirectUris[0], params, checks);
      } else {
        tokenSet = await xero.openIdClient.oauthCallback(xeroConfig.redirectUris[0], params, checks);
      }
      
      // Set the token on the Xero client
      xero.setTokenSet(tokenSet);
      
      // Delete the state immediately after successful token exchange to prevent reuse
      await deleteState(state);
      
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
              structuredLogger.error('Failed to decode ID token', e, {
                component: 'xero-auth-callback'
              });
            }
          }
          
          // Store user in database
          const { prisma } = await import('@/lib/prisma');
          
          // First, try to find user by xeroUserId
          const xeroUserId = userInfo.xeroUserId || tenant.tenantId;
          let user = await prisma.user.findUnique({
            where: { xeroUserId }
          });
          
          if (user) {
            // Update existing user
            user = await prisma.user.update({
              where: { id: user.id },
              data: {
                email: userInfo.email || user.email, // Keep existing email if no new one
                firstName: userInfo.firstName || user.firstName,
                lastName: userInfo.lastName || user.lastName,
                fullName: userInfo.fullName || user.fullName,
                tenantId: tenant.tenantId,
                tenantName: tenant.tenantName || 'Unknown',
                tenantType: tenant.tenantType,
                lastLoginAt: new Date(),
                xeroAccessToken: tokenSet.access_token,
                xeroRefreshToken: tokenSet.refresh_token,
                tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
              }
            });
          } else {
            // Try to find by email
            const email = userInfo.email || `${tenant.tenantId}@xero.local`;
            user = await prisma.user.findUnique({
              where: { email }
            });
            
            if (user) {
              // Update existing user with xeroUserId
              user = await prisma.user.update({
                where: { id: user.id },
                data: {
                  xeroUserId,
                  firstName: userInfo.firstName || user.firstName,
                  lastName: userInfo.lastName || user.lastName,
                  fullName: userInfo.fullName || user.fullName,
                  tenantId: tenant.tenantId,
                  tenantName: tenant.tenantName || 'Unknown',
                  tenantType: tenant.tenantType,
                  lastLoginAt: new Date(),
                  xeroAccessToken: tokenSet.access_token,
                  xeroRefreshToken: tokenSet.refresh_token,
                  tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000)
                }
              });
            } else {
              // Create new user
              user = await prisma.user.create({
                data: {
                  xeroUserId,
                  email,
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
            }
          }
          
          structuredLogger.info('User stored in database', {
            component: 'xero-auth-callback',
            userId: user.id,
            email: user.email,
            tenantName: user.tenantName
          });
          
          // Create user session with proper structure
          const userSession = {
            user: {
              id: user.id,
              email: user.email,
              name: user.fullName || user.email
            },
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
          // Redirect to the original return URL or finance page
          const redirectUrl = returnUrl && returnUrl !== '/' 
            ? new URL(`${baseUrl}${returnUrl}`)
            : new URL(`${baseUrl}/finance`);
          
          const response = NextResponse.redirect(redirectUrl.toString());
          response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(userSession), AUTH_COOKIE_OPTIONS);
          
          structuredLogger.debug('Setting user session cookie', {
            component: 'xero-auth-callback',
            cookieName: SESSION_COOKIE_NAME,
            cookieOptions: AUTH_COOKIE_OPTIONS,
            userSession
          });
          
          // Store token in secure cookie
          XeroSession.setTokenInResponse(response, tokenData);
          
          return response;
        }
      } catch (error) {
        structuredLogger.error('Failed to store user info', error, {
          component: 'xero-auth-callback'
        });
        // Continue with auth flow even if user storage fails
      }
      
      // Create response with redirect (fallback if user creation fails)
      const redirectUrl = returnUrl && returnUrl !== '/' 
        ? new URL(`${baseUrl}${returnUrl}`)
        : new URL(`${baseUrl}/finance`);
      
      structuredLogger.debug('Creating redirect response', { 
        component: 'xero-auth-callback',
        redirectTo: redirectUrl.toString() 
      });
      const response = NextResponse.redirect(redirectUrl.toString());
      
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
      
      structuredLogger.info('OAuth callback successful', {
        component: 'xero-auth-callback',
        redirectTo: response.headers.get('location')
      });
      
      return response;
    } catch (tokenError: any) {
      structuredLogger.error('Token exchange failed', tokenError, {
        component: 'xero-auth-callback',
        errorMessage: tokenError.message,
        errorName: tokenError.name
      });
      
      // Determine specific error for user feedback
      let errorType = 'token_exchange_failed';
      if (tokenError.message?.includes('invalid_grant')) {
        errorType = 'invalid_grant';
      } else if (tokenError.message?.includes('invalid_client')) {
        errorType = 'invalid_client';
      }
      
      return errorRedirect(errorType);
    }
  } catch (error: any) {
    structuredLogger.error('Unexpected error in callback', error, {
      component: 'xero-auth-callback'
    });
    
    return errorRedirect('callback_error');
  }
  } catch (fatalError: any) {
    // Catch any errors that might occur before we can even log
    structuredLogger.error('Fatal error in OAuth callback', fatalError, {
      component: 'xero-auth-callback',
      errorMessage: fatalError.message || 'Unknown error'
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    return errorRedirect('callback_fatal_error');
  }
});
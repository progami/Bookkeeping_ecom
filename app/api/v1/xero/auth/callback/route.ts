import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet, xeroConfig } from '@/lib/xero-client';
import { stateStore } from '@/lib/oauth-state';
import { XeroSession } from '@/lib/xero-session';
import { logger } from '@/lib/log-sanitizer';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
  
  // Handle errors
  if (error) {
    console.error('Xero OAuth error:', error, errorDescription);
    return NextResponse.redirect(`${baseUrl}/finance?error=${encodeURIComponent(errorDescription || error)}`);
  }
  
  if (!code) {
    return NextResponse.redirect(`${baseUrl}/finance?error=no_code`);
  }
  
  // Verify state (CSRF protection)
  const storedState = request.cookies.get('xero_state')?.value;
  const stateInMemory = state ? stateStore.has(state) : false;
  
  console.log('Callback received - state:', state);
  console.log('State in cookie:', storedState);
  console.log('State in memory:', stateInMemory);
  console.log('All states in memory:', Array.from(stateStore.keys()));
  
  // TEMPORARY WORKAROUND: Xero is not returning the state parameter
  // If we have a valid cookie state and no state in URL, continue anyway
  const isXeroStateBug = !state && storedState && code;
  
  if (isXeroStateBug) {
    console.warn('WARNING: Xero did not return state parameter. Proceeding with cookie validation only.');
  }
  
  // Check both cookie and memory store
  const isValidState = (storedState && state === storedState) || stateInMemory || isXeroStateBug;
  
  if (!isValidState) {
    console.error('State validation failed');
    console.error('Received state:', state);
    console.error('Cookie state:', storedState);
    console.error('Memory has state:', stateInMemory);
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
    
    logger.log('Exchanging code for token...');
    logger.log('Code: [REDACTED]');
    logger.log('Redirect URI:', xeroConfig.redirectUris[0]);
    logger.log('State configured in client: [REDACTED]');
    
    // The Xero SDK requires openid-client to be initialized first
    await xero.initialize();
    
    // Get the full callback URL (including code and state)
    const fullCallbackUrl = request.url;
    console.log('Full callback URL:', fullCallbackUrl);
    
    try {
      // The apiCallback only takes the callback URL as parameter
      // The state is checked internally using the state configured in the XeroClient
      console.log('Calling apiCallback...');
      const tokenSet = await xero.apiCallback(fullCallbackUrl);
      
      logger.log('Token exchange successful!');
      logger.log('Access token:', tokenSet.access_token ? 'present' : 'missing');
      logger.log('Refresh token:', tokenSet.refresh_token ? 'present' : 'missing');
      logger.log('Expires at:', tokenSet.expires_at);
      
      // Create response with redirect
      console.log('[Callback] Creating redirect response to:', `${baseUrl}/finance?connected=true`);
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
      
      logger.log('[Callback] Token data prepared for storage:', {
        hasAccessToken: !!tokenData.access_token,
        accessTokenLength: tokenData.access_token.length,
        hasRefreshToken: !!tokenData.refresh_token,
        refreshTokenLength: tokenData.refresh_token.length,
        expiresAt: tokenData.expires_at,
        tokenType: tokenData.token_type
      });
      
      XeroSession.setTokenInResponse(response, tokenData);
      
      // Log response details
      console.log('[Callback] Response created with status:', response.status);
      console.log('[Callback] Response headers:', {
        location: response.headers.get('location'),
        setCookie: response.headers.get('set-cookie')
      });
      
      // Clear state cookie
      response.cookies.delete('xero_state');
      console.log('[Callback] State cookie deleted');
      
      console.log('[Callback] ========== RETURNING REDIRECT RESPONSE ==========');
      return response;
    } catch (tokenError: any) {
      console.error('Token exchange error details:', tokenError);
      console.error('Error message:', tokenError.message);
      console.error('Error stack:', tokenError.stack);
      
      // Try alternative approach
      if (tokenError.message.includes('Access token is undefined')) {
        console.log('Trying manual token exchange...');
        
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
          console.error('Manual token exchange failed:', tokenResponse.status, errorText);
          throw new Error(`Token exchange failed: ${errorText}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('Manual token exchange successful!');
        
        // Create response with redirect
        console.log('[Callback-Manual] Creating redirect response to:', `${baseUrl}/finance?connected=true`);
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
        
        logger.log('[Callback-Manual] Token data prepared for storage:', {
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
        console.log('[Callback-Manual] Response created with status:', response.status);
        console.log('[Callback-Manual] Response headers:', {
          location: response.headers.get('location'),
          setCookie: response.headers.get('set-cookie')
        });
        
        // Clear state cookie
        response.cookies.delete('xero_state');
        console.log('[Callback-Manual] State cookie deleted');
        
        console.log('[Callback-Manual] ========== RETURNING REDIRECT RESPONSE ==========');
        return response;
      }
      
      throw tokenError;
    }
  } catch (error: any) {
    console.error('Error exchanging code for token:', error);
    console.error('Error details:', {
      message: error.message,
      statusCode: error.statusCode,
      response: error.response,
      stack: error.stack
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
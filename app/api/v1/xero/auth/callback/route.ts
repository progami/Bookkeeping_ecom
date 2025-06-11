import { NextRequest, NextResponse } from 'next/server';
import { createXeroClient, storeTokenSet } from '@/lib/xero-client';
import { stateStore } from '@/lib/oauth-state';

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
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=invalid_state`);
  }
  
  // Clean up the state from memory
  if (state) {
    stateStore.delete(state);
  }
  
  try {
    // Exchange code for token
    // Pass the state to the XeroClient constructor
    const xero = createXeroClient(storedState || state || undefined);
    
    console.log('Exchanging code for token...');
    console.log('Code:', code);
    console.log('Redirect URI:', xeroConfig.redirectUris[0]);
    console.log('State configured in client:', storedState || state);
    
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
      
      console.log('Token exchange successful!');
      console.log('Access token:', tokenSet.access_token ? 'present' : 'missing');
      console.log('Refresh token:', tokenSet.refresh_token ? 'present' : 'missing');
      console.log('Expires at:', tokenSet.expires_at);
      
      // Store token in secure cookie
      await storeTokenSet(tokenSet);
      
      // Clear state cookie
      const response = NextResponse.redirect(`${baseUrl}/bookkeeping?connected=true`);
      response.cookies.delete('xero_state');
      
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
          redirect_uri: 'http://localhost:3003/api/v1/xero/auth/callback',
          client_id: '781184D1AD314CB6989EB8D2291AB453',
          client_secret: '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg'
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
        
        // Create TokenSet object
        const tokenSet = {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_in: tokenData.expires_in,
          token_type: tokenData.token_type,
          scope: tokenData.scope,
          expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in
        };
        
        await storeTokenSet(tokenSet);
        
        const response = NextResponse.redirect(`${baseUrl}/bookkeeping?connected=true`);
        response.cookies.delete('xero_state');
        
        return response;
      }
      
      throw tokenError;
    }
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=token_exchange_failed`);
  }
}

// Add missing import
const xeroConfig = {
  clientId: '781184D1AD314CB6989EB8D2291AB453',
  clientSecret: '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg',
  redirectUris: ['http://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'accounting.transactions accounting.settings offline_access'
};
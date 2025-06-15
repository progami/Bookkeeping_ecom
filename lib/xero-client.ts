import { XeroClient } from 'xero-node';
import { TokenSet } from 'xero-node';
import { cookies } from 'next/headers';
import { serialize, parse } from 'cookie';
import { XeroSession, XeroTokenSet } from './xero-session';
import { tokenRefreshLock } from './token-refresh-lock';
import { structuredLogger } from './logger';

// Minimized scopes - only request what we need
export const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'accounting.transactions.read accounting.reports.read accounting.settings.read offline_access'
};

export function createXeroClient(state?: string) {
  const xero = new XeroClient({
    clientId: xeroConfig.clientId,
    clientSecret: xeroConfig.clientSecret,
    redirectUris: xeroConfig.redirectUris,
    scopes: xeroConfig.scopes.split(' '),
    state: state
  });
  
  return xero;
}

export async function getStoredTokenSet(): Promise<TokenSet | null> {
  return await XeroSession.getToken() as TokenSet | null;
}

export async function storeTokenSet(tokenSet: TokenSet | any) {
  const tokenData: XeroTokenSet = {
    access_token: tokenSet.access_token,
    refresh_token: tokenSet.refresh_token,
    expires_at: tokenSet.expires_at || (Math.floor(Date.now() / 1000) + (tokenSet.expires_in || 1800)),
    expires_in: tokenSet.expires_in,
    token_type: tokenSet.token_type,
    scope: tokenSet.scope
  };
  
  await XeroSession.setToken(tokenData);
}

export async function clearTokenSet() {
  await XeroSession.clearToken();
}

export async function getXeroClient(): Promise<XeroClient | null> {
  try {
    structuredLogger.debug('Starting Xero client retrieval', {
      component: 'xero-client',
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      redirectUri: process.env.XERO_REDIRECT_URI
    });
    
    const tokenSet = await getStoredTokenSet();
    structuredLogger.debug('Token retrieval complete', { component: 'xero-client' });
    
    if (!tokenSet) {
      structuredLogger.info('No token set found - user not authenticated', { component: 'xero-client' });
      return null;
    }
    
    structuredLogger.debug('Token set retrieved', {
      component: 'xero-client',
      hasAccessToken: !!tokenSet.access_token,
      hasRefreshToken: !!tokenSet.refresh_token,
      expiresAt: tokenSet.expires_at,
      tokenType: tokenSet.token_type,
      scope: tokenSet.scope
    });
    
    // Validate token structure
    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      structuredLogger.error('Invalid token structure - missing required fields', undefined, {
        component: 'xero-client',
        hasAccessToken: !!tokenSet.access_token,
        hasRefreshToken: !!tokenSet.refresh_token
      });
      await clearTokenSet();
      return null;
    }
    
    const xero = createXeroClient();
    
    // Set the token on the client
    try {
      xero.setTokenSet(tokenSet);
    } catch (error) {
      structuredLogger.error('Failed to set token on Xero client', error, { component: 'xero-client' });
      return null;
    }
    
    // Check if token needs refresh
    const expiresAt = tokenSet.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer
    
    structuredLogger.debug('Token expiry check', { 
      component: 'xero-client',
      expiresAt, 
      now, 
      needsRefresh: expiresAt < (now + bufferTime),
      expiresIn: expiresAt - now 
    });
    
    if (expiresAt < (now + bufferTime)) {
      try {
        structuredLogger.info('Token needs refresh', { 
          component: 'xero-client',
          expiresIn: expiresAt - now 
        });
        
        // Use lock to prevent concurrent refreshes
        const refreshKey = `xero-refresh-${tokenSet.refresh_token?.substring(0, 8) || 'default'}`;
        
        const newTokenSet = await tokenRefreshLock.acquireRefreshLock(
          refreshKey,
          async () => {
            structuredLogger.debug('Executing token refresh', { component: 'xero-client' });
            const refreshedToken = await xero.refreshWithRefreshToken(
              xeroConfig.clientId, 
              xeroConfig.clientSecret, 
              tokenSet.refresh_token
            );
            
            // Store the new token set
            await storeTokenSet(refreshedToken);
            structuredLogger.debug('Token stored successfully', { 
              component: 'xero-client',
              newExpiry: refreshedToken.expires_at 
            });
            
            return refreshedToken;
          }
        );
        
        // Set the new token on the client
        xero.setTokenSet(newTokenSet);
        structuredLogger.info('Token refresh completed successfully', { component: 'xero-client' });
      } catch (error: any) {
        structuredLogger.error('Failed to refresh token', error, { component: 'xero-client' });
        await clearTokenSet();
        return null;
      }
    }
    
    return xero;
  } catch (error) {
    structuredLogger.error('Unexpected error in getXeroClient', error, { component: 'xero-client' });
    return null;
  }
}

export async function getXeroClientWithTenant(): Promise<{ client: XeroClient; tenantId: string } | null> {
  const xeroClient = await getXeroClient();
  if (!xeroClient) {
    return null;
  }

  // Update tenants to get tenant ID
  await xeroClient.updateTenants();
  const tenantId = xeroClient.tenants[0]?.tenantId;
  if (!tenantId) {
    return null;
  }

  return { client: xeroClient, tenantId };
}

export async function getAuthUrl(state?: string, codeChallenge?: string): Promise<string> {
  // Pass the state to createXeroClient so it's included in the config
  const xero = createXeroClient(state);
  
  try {
    await xero.initialize();
  } catch (error) {
    console.error('[getAuthUrl] Failed to initialize Xero client:', error);
    throw error;
  }
  
  // Get the consent URL - the state will be included automatically
  let authUrl = await xero.buildConsentUrl();
  
  // Add PKCE challenge if provided
  if (codeChallenge) {
    const url = new URL(authUrl);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    authUrl = url.toString();
  }
  
  console.log('[getAuthUrl] Built auth URL with PKCE:', authUrl);
  
  return authUrl;
}
import { XeroClient } from 'xero-node';
import { TokenSet } from 'xero-node';
import { cookies } from 'next/headers';
import { serialize, parse } from 'cookie';
import { XeroSession, XeroTokenSet } from './xero-session';
import { tokenRefreshLock } from './token-refresh-lock';
import { logger } from './log-sanitizer';

export const xeroConfig = {
  clientId: process.env.XERO_CLIENT_ID || '',
  clientSecret: process.env.XERO_CLIENT_SECRET || '',
  redirectUris: [process.env.XERO_REDIRECT_URI || 'https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'accounting.transactions accounting.settings accounting.reports.read offline_access'
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
    console.log('[getXeroClient] Starting Xero client retrieval...');
    console.log('[getXeroClient] Environment check:', {
      hasClientId: !!process.env.XERO_CLIENT_ID,
      hasClientSecret: !!process.env.XERO_CLIENT_SECRET,
      redirectUri: process.env.XERO_REDIRECT_URI
    });
    
    const tokenSet = await getStoredTokenSet();
    console.log('[getXeroClient] Token retrieval complete');
    
    if (!tokenSet) {
      console.log('[getXeroClient] No token set found - user not authenticated');
      return null;
    }
    
    logger.log('[getXeroClient] Token set retrieved:', {
      hasAccessToken: !!tokenSet.access_token,
      hasRefreshToken: !!tokenSet.refresh_token,
      expiresAt: tokenSet.expires_at,
      tokenType: tokenSet.token_type,
      scope: tokenSet.scope
    });
    
    // Validate token structure
    if (!tokenSet.access_token || !tokenSet.refresh_token) {
      console.error('[getXeroClient] Invalid token structure - missing required fields:', {
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
      console.error('Failed to set token on Xero client:', error);
      return null;
    }
    
    // Check if token needs refresh
    const expiresAt = tokenSet.expires_at || 0;
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer
    
    console.log('Token expiry check:', { 
      expiresAt, 
      now, 
      needsRefresh: expiresAt < (now + bufferTime),
      expiresIn: expiresAt - now 
    });
    
    if (expiresAt < (now + bufferTime)) {
      try {
        console.log('Token needs refresh (expires in', expiresAt - now, 'seconds)...');
        
        // Use lock to prevent concurrent refreshes
        const refreshKey = `xero-refresh-${tokenSet.refresh_token?.substring(0, 8) || 'default'}`;
        
        const newTokenSet = await tokenRefreshLock.acquireRefreshLock(
          refreshKey,
          async () => {
            console.log('Executing token refresh...');
            const refreshedToken = await xero.refreshWithRefreshToken(
              xeroConfig.clientId, 
              xeroConfig.clientSecret, 
              tokenSet.refresh_token
            );
            
            // Store the new token set
            await storeTokenSet(refreshedToken);
            console.log('Token stored successfully, new expiry:', refreshedToken.expires_at);
            
            return refreshedToken;
          }
        );
        
        // Set the new token on the client
        xero.setTokenSet(newTokenSet);
        console.log('Token refresh completed successfully');
      } catch (error: any) {
        console.error('Failed to refresh token:', error.message || error);
        await clearTokenSet();
        return null;
      }
    }
    
    return xero;
  } catch (error) {
    console.error('Unexpected error in getXeroClient:', error);
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

export async function getAuthUrl(state?: string): Promise<string> {
  // Pass the state to createXeroClient so it's included in the config
  const xero = createXeroClient(state);
  
  try {
    await xero.initialize();
  } catch (error) {
    console.error('[getAuthUrl] Failed to initialize Xero client:', error);
    throw error;
  }
  
  // Get the consent URL - the state will be included automatically
  const authUrl = await xero.buildConsentUrl();
  
  console.log('[getAuthUrl] Built auth URL:', authUrl);
  
  return authUrl;
}
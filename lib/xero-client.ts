import { XeroClient } from 'xero-node';
import { TokenSet } from 'xero-node';
import { cookies } from 'next/headers';
import { serialize, parse } from 'cookie';

const xeroConfig = {
  clientId: '781184D1AD314CB6989EB8D2291AB453',
  clientSecret: '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg',
  redirectUris: ['http://localhost:3003/api/v1/xero/auth/callback'],
  scopes: 'accounting.transactions accounting.settings offline_access'
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
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('xero_token');
  
  if (!tokenCookie) {
    return null;
  }
  
  try {
    return JSON.parse(tokenCookie.value);
  } catch {
    return null;
  }
}

export async function storeTokenSet(tokenSet: TokenSet | any) {
  const cookieStore = await cookies();
  
  console.log('Storing token set...');
  
  cookieStore.set('xero_token', JSON.stringify(tokenSet), {
    httpOnly: true,
    secure: false, // Set to false for local development
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });
  
  console.log('Token set stored successfully');
}

export async function clearTokenSet() {
  const cookieStore = await cookies();
  cookieStore.delete('xero_token');
}

export async function getXeroClient(): Promise<XeroClient | null> {
  console.log('Getting Xero client...');
  const tokenSet = await getStoredTokenSet();
  
  if (!tokenSet) {
    console.log('No token set found in cookies');
    return null;
  }
  
  console.log('Token set found:', {
    hasAccessToken: !!tokenSet.access_token,
    hasRefreshToken: !!tokenSet.refresh_token,
    expiresAt: tokenSet.expires_at
  });
  
  const xero = createXeroClient();
  xero.setTokenSet(tokenSet);
  
  // Check if token needs refresh
  const expiresAt = tokenSet.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  
  console.log('Token expiry check:', { expiresAt, now, needsRefresh: expiresAt < now });
  
  if (expiresAt < now) {
    try {
      console.log('Refreshing expired token...');
      const newTokenSet = await xero.refreshWithRefreshToken(xeroConfig.clientId, xeroConfig.clientSecret, tokenSet.refresh_token);
      await storeTokenSet(newTokenSet);
      xero.setTokenSet(newTokenSet);
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await clearTokenSet();
      return null;
    }
  }
  
  return xero;
}

export async function getAuthUrl(state?: string): Promise<string> {
  // Pass the state to createXeroClient so it's included in the config
  const xero = createXeroClient(state);
  await xero.initialize();
  
  // Get the consent URL - the state will be included automatically
  const authUrl = await xero.buildConsentUrl();
  
  console.log('Built auth URL:', authUrl);
  
  return authUrl;
}
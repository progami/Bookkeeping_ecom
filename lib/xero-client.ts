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

export function createXeroClient() {
  const xero = new XeroClient({
    clientId: xeroConfig.clientId,
    clientSecret: xeroConfig.clientSecret,
    redirectUris: xeroConfig.redirectUris,
    scopes: xeroConfig.scopes.split(' ')
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

export async function storeTokenSet(tokenSet: TokenSet) {
  const cookieStore = await cookies();
  
  cookieStore.set('xero_token', JSON.stringify(tokenSet), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/'
  });
}

export async function clearTokenSet() {
  const cookieStore = await cookies();
  cookieStore.delete('xero_token');
}

export async function getXeroClient(): Promise<XeroClient | null> {
  const tokenSet = await getStoredTokenSet();
  
  if (!tokenSet) {
    return null;
  }
  
  const xero = createXeroClient();
  xero.setTokenSet(tokenSet);
  
  // Check if token needs refresh
  const expiresAt = tokenSet.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);
  
  if (expiresAt < now) {
    try {
      const newTokenSet = await xero.refreshWithRefreshToken(xeroConfig.clientId, xeroConfig.clientSecret, tokenSet.refresh_token);
      await storeTokenSet(newTokenSet);
      xero.setTokenSet(newTokenSet);
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await clearTokenSet();
      return null;
    }
  }
  
  return xero;
}

export async function getAuthUrl(state?: string): Promise<string> {
  const xero = createXeroClient();
  await xero.initialize();
  
  const authUrl = await xero.buildConsentUrl();
  return authUrl;
}
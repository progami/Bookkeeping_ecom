import { XeroClient } from 'xero-node';
import { TokenSet } from 'xero-node';
import { cookies } from 'next/headers';

export async function getXeroClient() {
  const cookieStore = cookies();
  const tokenSetCookie = cookieStore.get('xero_token_set');
  
  if (!tokenSetCookie?.value) {
    throw new Error('No Xero token found');
  }
  
  const tokenSet = JSON.parse(tokenSetCookie.value);
  
  const xero = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: process.env.XERO_SCOPES!.split(' ')
  });
  
  xero.setTokenSet(tokenSet);
  
  // Check if token needs refresh
  if (tokenSet.expires_at && tokenSet.expires_at * 1000 < Date.now()) {
    const newTokenSet = await xero.refreshToken();
    // Update the cookie with new token
    cookieStore.set('xero_token_set', JSON.stringify(newTokenSet), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
  }
  
  return xero;
}

export async function getGLAccounts() {
  try {
    const xero = await getXeroClient();
    const tokenSet = await xero.readTokenSet();
    const tenantId = tokenSet.tenant_id as string;
    
    if (!tenantId || typeof tenantId !== 'string') {
      console.error('No tenant ID found');
      return [];
    }
    
    const response = await xero.accountingApi.getAccounts(
      tenantId,
      undefined, // ifModifiedSince
      undefined, // where
      undefined, // order
      undefined  // includeArchived
    );
    
    return response.body.accounts?.map(account => ({
      code: account.code || '',
      name: account.name || '',
      type: account.type,
      status: account.status
    })) || [];
  } catch (error) {
    console.error('Error fetching GL accounts:', error);
    return [];
  }
}

export async function getTenantId() {
  const xero = await getXeroClient();
  const tokenSet = await xero.readTokenSet();
  return tokenSet.tenant_id || '';
}
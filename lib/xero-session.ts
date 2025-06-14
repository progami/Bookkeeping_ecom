import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'xero_token';

// Determine if we're in a secure context
const isSecureContext = process.env.NODE_ENV === 'production' || 
                       (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('https://'));

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isSecureContext,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/',
  // Explicitly set domain to ensure cookie is available across all routes
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
};

console.log('[XeroSession] Cookie configuration:', {
  name: COOKIE_NAME,
  options: COOKIE_OPTIONS,
  nodeEnv: process.env.NODE_ENV,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  isSecureContext,
  cookieDomain: process.env.COOKIE_DOMAIN || 'not set'
});

export interface XeroTokenSet {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export class XeroSession {
  static async getToken(): Promise<XeroTokenSet | null> {
    try {
      console.log('[XeroSession.getToken] Starting token retrieval...');
      
      const cookieStore = await cookies();
      console.log('[XeroSession.getToken] Cookie store obtained');
      
      // Log all cookies for debugging
      const allCookies = cookieStore.getAll();
      console.log('[XeroSession.getToken] All cookies available:', allCookies.map(c => ({
        name: c.name,
        valueLength: c.value?.length || 0,
        sameSite: c.sameSite,
        secure: c.secure,
        httpOnly: c.httpOnly,
        path: c.path
      })));
      
      const tokenCookie = cookieStore.get(COOKIE_NAME);
      console.log('[XeroSession.getToken] Looking for cookie:', COOKIE_NAME);
      console.log('[XeroSession.getToken] Token cookie found:', !!tokenCookie);
      
      if (!tokenCookie?.value) {
        console.log('[XeroSession.getToken] No token cookie found or cookie has no value');
        return null;
      }
      
      console.log('[XeroSession.getToken] Token cookie details:', {
        name: tokenCookie.name,
        valueLength: tokenCookie.value.length,
        valuePreview: tokenCookie.value.substring(0, 50) + '...',
        sameSite: tokenCookie.sameSite,
        secure: tokenCookie.secure,
        httpOnly: tokenCookie.httpOnly,
        path: tokenCookie.path
      });
      
      try {
        const token = JSON.parse(tokenCookie.value) as XeroTokenSet;
        console.log('[XeroSession.getToken] Token parsed successfully:', {
          hasAccessToken: !!token.access_token,
          hasRefreshToken: !!token.refresh_token,
          expiresAt: token.expires_at,
          expiresIn: token.expires_in,
          tokenType: token.token_type,
          scope: token.scope
        });
        return token;
      } catch (parseError) {
        console.error('[XeroSession.getToken] Failed to parse token JSON:', parseError);
        console.error('[XeroSession.getToken] Invalid token value:', tokenCookie.value);
        return null;
      }
    } catch (error) {
      console.error('[XeroSession.getToken] Unexpected error:', error);
      return null;
    }
  }
  
  static async setToken(token: XeroTokenSet): Promise<void> {
    try {
      console.log('[XeroSession.setToken] Starting token storage...');
      console.log('[XeroSession.setToken] Token to store:', {
        hasAccessToken: !!token.access_token,
        hasRefreshToken: !!token.refresh_token,
        expiresAt: token.expires_at,
        expiresIn: token.expires_in,
        tokenType: token.token_type,
        scope: token.scope
      });
      
      const cookieStore = await cookies();
      console.log('[XeroSession.setToken] Cookie store obtained');
      
      // Ensure expires_at is set
      if (!token.expires_at && token.expires_in) {
        token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
        console.log('[XeroSession.setToken] Calculated expires_at:', token.expires_at);
      }
      
      const tokenString = JSON.stringify(token);
      console.log('[XeroSession.setToken] Token serialized, length:', tokenString.length);
      console.log('[XeroSession.setToken] Cookie options:', COOKIE_OPTIONS);
      
      cookieStore.set(COOKIE_NAME, tokenString, COOKIE_OPTIONS);
      console.log('[XeroSession.setToken] Token cookie set successfully');
      
      // Verify the cookie was set
      const verifyToken = cookieStore.get(COOKIE_NAME);
      console.log('[XeroSession.setToken] Verification - cookie exists:', !!verifyToken);
      if (verifyToken) {
        console.log('[XeroSession.setToken] Verification - cookie details:', {
          name: verifyToken.name,
          valueLength: verifyToken.value?.length || 0,
          sameSite: verifyToken.sameSite,
          secure: verifyToken.secure,
          httpOnly: verifyToken.httpOnly,
          path: verifyToken.path
        });
      }
    } catch (error) {
      console.error('[XeroSession.setToken] Error setting token:', error);
      throw error;
    }
  }
  
  static async clearToken(): Promise<void> {
    try {
      const cookieStore = await cookies();
      cookieStore.delete({
        name: COOKIE_NAME,
        path: '/'
      });
      console.log('XeroSession: Token cleared');
    } catch (error) {
      console.error('XeroSession: Error clearing token:', error);
    }
  }
  
  static async isTokenExpired(token: XeroTokenSet): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer
    return token.expires_at < (now + bufferTime);
  }
  
  // Helper method to set token in response headers (for auth callback)
  static setTokenInResponse(response: NextResponse, token: XeroTokenSet): NextResponse {
    console.log('[XeroSession.setTokenInResponse] Starting token storage in response...');
    console.log('[XeroSession.setTokenInResponse] Token to store:', {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      expiresAt: token.expires_at,
      expiresIn: token.expires_in,
      tokenType: token.token_type,
      scope: token.scope
    });
    
    // Ensure expires_at is set
    if (!token.expires_at && token.expires_in) {
      token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
      console.log('[XeroSession.setTokenInResponse] Calculated expires_at:', token.expires_at);
    }
    
    const tokenString = JSON.stringify(token);
    console.log('[XeroSession.setTokenInResponse] Token serialized, length:', tokenString.length);
    console.log('[XeroSession.setTokenInResponse] Cookie name:', COOKIE_NAME);
    console.log('[XeroSession.setTokenInResponse] Cookie options:', COOKIE_OPTIONS);
    
    response.cookies.set(COOKIE_NAME, tokenString, COOKIE_OPTIONS);
    console.log('[XeroSession.setTokenInResponse] Cookie set on response');
    
    // Log response headers for debugging
    console.log('[XeroSession.setTokenInResponse] Response headers after setting cookie:', {
      setCookie: response.headers.get('set-cookie'),
      hasCookies: response.headers.has('set-cookie')
    });
    
    return response;
  }
}
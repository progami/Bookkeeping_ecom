import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
// Removed duplicate logger import - using only structuredLogger
import { structuredLogger } from './logger';
import { AUTH_COOKIE_OPTIONS, TOKEN_COOKIE_NAME } from './cookie-config';

const COOKIE_NAME = TOKEN_COOKIE_NAME;
const COOKIE_OPTIONS = AUTH_COOKIE_OPTIONS;

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
      structuredLogger.debug('[XeroSession.getToken] Starting token retrieval...');
      
      const cookieStore = await cookies();
      structuredLogger.debug('[XeroSession.getToken] Cookie store obtained');
      
      // Log all cookies for debugging
      const allCookies = cookieStore.getAll();
      structuredLogger.debug('[XeroSession.getToken] All cookies available:', {
        cookies: allCookies.map(c => ({
          name: c.name,
          valueLength: c.value?.length || 0
        }))
      });
      
      const tokenCookie = cookieStore.get(COOKIE_NAME);
      structuredLogger.debug('[XeroSession.getToken] Looking for cookie:', { cookieName: COOKIE_NAME });
      structuredLogger.debug('[XeroSession.getToken] Token cookie found:', { found: !!tokenCookie });
      
      if (!tokenCookie?.value) {
        structuredLogger.debug('[XeroSession.getToken] No token cookie found or cookie has no value');
        return null;
      }
      
      structuredLogger.debug('[XeroSession.getToken] Token cookie details:', {
        name: tokenCookie.name,
        valueLength: tokenCookie.value.length
      });
      
      try {
        const token = JSON.parse(tokenCookie.value) as XeroTokenSet;
        structuredLogger.debug('[XeroSession.getToken] Token parsed successfully:', {
          hasAccessToken: !!token.access_token,
          hasRefreshToken: !!token.refresh_token,
          expiresAt: token.expires_at,
          expiresIn: token.expires_in,
          tokenType: token.token_type,
          scope: token.scope
        });
        return token;
      } catch (parseError) {
        structuredLogger.error('[XeroSession.getToken] Failed to parse token JSON', parseError as Error, {
          tokenValue: tokenCookie.value
        });
        return null;
      }
    } catch (error) {
      structuredLogger.error('[XeroSession.getToken] Unexpected error', error as Error);
      return null;
    }
  }
  
  static async setToken(token: XeroTokenSet): Promise<void> {
    try {
      structuredLogger.debug('[XeroSession.setToken] Starting token storage...');
      structuredLogger.info('[XeroSession.setToken] Token to store:', {
        hasAccessToken: !!token.access_token,
        hasRefreshToken: !!token.refresh_token,
        expiresAt: token.expires_at,
        expiresIn: token.expires_in,
        tokenType: token.token_type,
        scope: token.scope
      });
      
      const cookieStore = await cookies();
      structuredLogger.debug('[XeroSession.setToken] Cookie store obtained');
      
      // Ensure expires_at is set
      if (!token.expires_at && token.expires_in) {
        token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
        structuredLogger.debug('[XeroSession.setToken] Calculated expires_at:', { expiresAt: token.expires_at });
      }
      
      const tokenString = JSON.stringify(token);
      structuredLogger.debug('[XeroSession.setToken] Token serialized', { length: tokenString.length });
      structuredLogger.debug('[XeroSession.setToken] Cookie options:', COOKIE_OPTIONS);
      
      cookieStore.set(COOKIE_NAME, tokenString, COOKIE_OPTIONS);
      structuredLogger.debug('[XeroSession.setToken] Token cookie set successfully');
      
      // Verify the cookie was set
      const verifyToken = cookieStore.get(COOKIE_NAME);
      structuredLogger.debug('[XeroSession.setToken] Verification - cookie exists:', { exists: !!verifyToken });
      if (verifyToken) {
        structuredLogger.debug('[XeroSession.setToken] Verification - cookie details:', {
          name: verifyToken.name,
          valueLength: verifyToken.value?.length || 0
        });
      }
    } catch (error) {
      structuredLogger.error('[XeroSession.setToken] Error setting token', error as Error);
      throw error;
    }
  }
  
  static async clearToken(): Promise<void> {
    try {
      const cookieStore = await cookies();
      // Use the newer delete method signature
      cookieStore.delete(COOKIE_NAME);
      structuredLogger.info('[XeroSession.clearToken] Token cookie deleted');
    } catch (error) {
      structuredLogger.error('[XeroSession.clearToken] Error clearing token', error as Error);
      // Fallback: try setting empty cookie with expired date
      try {
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, '', {
          maxAge: -1,
          path: '/',
          expires: new Date(0)
        });
        structuredLogger.info('[XeroSession.clearToken] Token cleared using fallback method');
      } catch (fallbackError) {
        structuredLogger.error('[XeroSession.clearToken] Fallback also failed', fallbackError as Error);
      }
    }
  }
  
  static async isTokenExpired(token: XeroTokenSet): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 300; // 5 minutes buffer
    return token.expires_at < (now + bufferTime);
  }
  
  // Helper method to set token in response headers (for auth callback)
  static setTokenInResponse(response: NextResponse, token: XeroTokenSet): NextResponse {
    structuredLogger.debug('[XeroSession.setTokenInResponse] Starting token storage in response...');
    structuredLogger.info('[XeroSession.setTokenInResponse] Token to store:', {
      hasAccessToken: '[REDACTED]',
      hasRefreshToken: '[REDACTED]',
      expiresAt: token.expires_at,
      expiresIn: token.expires_in,
      tokenType: '[REDACTED]',
      scope: token.scope
    });
    
    // Ensure expires_at is set
    if (!token.expires_at && token.expires_in) {
      token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
      structuredLogger.debug('[XeroSession.setTokenInResponse] Calculated expires_at:', { expiresAt: token.expires_at });
    }
    
    const tokenString = JSON.stringify(token);
    structuredLogger.debug('[XeroSession.setTokenInResponse] Token serialized', { length: tokenString.length });
    structuredLogger.debug('[XeroSession.setTokenInResponse] Cookie name:', { cookieName: COOKIE_NAME });
    structuredLogger.debug('[XeroSession.setTokenInResponse] Cookie options:', COOKIE_OPTIONS);
    
    response.cookies.set(COOKIE_NAME, tokenString, COOKIE_OPTIONS);
    structuredLogger.debug('[XeroSession.setTokenInResponse] Cookie set on response');
    
    // Log response headers for debugging
    structuredLogger.debug('[XeroSession.setTokenInResponse] Response headers after setting cookie:', {
      setCookie: response.headers.get('set-cookie'),
      hasCookies: response.headers.has('set-cookie')
    });
    
    return response;
  }
}
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'xero_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'),
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: '/'
};

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
      const cookieStore = await cookies();
      const tokenCookie = cookieStore.get(COOKIE_NAME);
      
      if (!tokenCookie?.value) {
        console.log('XeroSession: No token cookie found');
        return null;
      }
      
      const token = JSON.parse(tokenCookie.value) as XeroTokenSet;
      console.log('XeroSession: Token retrieved successfully');
      return token;
    } catch (error) {
      console.error('XeroSession: Error getting token:', error);
      return null;
    }
  }
  
  static async setToken(token: XeroTokenSet): Promise<void> {
    try {
      const cookieStore = await cookies();
      
      // Ensure expires_at is set
      if (!token.expires_at && token.expires_in) {
        token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
      }
      
      cookieStore.set(COOKIE_NAME, JSON.stringify(token), COOKIE_OPTIONS);
      console.log('XeroSession: Token stored successfully');
    } catch (error) {
      console.error('XeroSession: Error setting token:', error);
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
    // Ensure expires_at is set
    if (!token.expires_at && token.expires_in) {
      token.expires_at = Math.floor(Date.now() / 1000) + token.expires_in;
    }
    
    response.cookies.set(COOKIE_NAME, JSON.stringify(token), COOKIE_OPTIONS);
    return response;
  }
}
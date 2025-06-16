import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';

// Determine if we're in a secure context
const isProduction = process.env.NODE_ENV === 'production';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
const isHttps = appUrl.startsWith('https://');

// For localhost development, we need to use secure: false
// even if the URL is https://localhost because browsers handle
// localhost differently for secure cookies
const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');
const isSecureContext = isProduction || (isHttps && !isLocalhost);

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isSecureContext,
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/',
};

export const SESSION_COOKIE_NAME = 'user_session';
export const TOKEN_COOKIE_NAME = 'xero_token';

console.log('[CookieConfig] Configuration:', {
  isProduction,
  appUrl,
  isHttps,
  isLocalhost,
  isSecureContext,
  cookieOptions: AUTH_COOKIE_OPTIONS
});
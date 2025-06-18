import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { structuredLogger as logger } from './logger';

// Determine if we're in a secure context
const isProduction = process.env.NODE_ENV === 'production';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
const isHttps = appUrl.startsWith('https://');

// Simplified logic: use secure cookies whenever we're in production or using HTTPS
const isSecureContext = isProduction || isHttps;

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isSecureContext,
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/',
};

export const SESSION_COOKIE_NAME = 'user_session';
export const TOKEN_COOKIE_NAME = 'xero_token';

logger.info('[CookieConfig] Configuration', {
  isProduction,
  appUrl,
  isHttps,
  isSecureContext,
  cookieOptions: AUTH_COOKIE_OPTIONS
});
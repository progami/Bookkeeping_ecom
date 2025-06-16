import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Content Security Policy
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.xero.com https://identity.xero.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

// Configuration
const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB default
const REQUEST_TIMEOUT = 30000; // 30 seconds default
const SYNC_REQUEST_TIMEOUT = 300000; // 5 minutes for sync operations

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Add a custom header to track if this is an API route
  if (request.nextUrl.pathname.startsWith('/api/')) {
    requestHeaders.set('x-api-route', 'true');
  }
  
  // Check request size for POST/PUT/PATCH requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentLength = request.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: 'Request body too large', maxSize: MAX_REQUEST_SIZE },
        { status: 413 }
      );
    }
  }
  
  // Set request timeout based on endpoint
  const isSync = request.nextUrl.pathname.includes('/sync');
  const timeout = isSync ? SYNC_REQUEST_TIMEOUT : REQUEST_TIMEOUT;
  requestHeaders.set('x-request-timeout', timeout.toString());
  
  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Add HSTS header for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }
  
  // Add CSP header (relaxed for development)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', CSP_DIRECTIVES);
  }
  
  // Request ID for tracking
  const requestId = crypto.randomUUID();
  requestHeaders.set('x-request-id', requestId);
  response.headers.set('x-request-id', requestId);
  
  // For API routes, ensure cookies are properly forwarded
  if (request.nextUrl.pathname.startsWith('/api/v1/xero/')) {
    // Log cookie debugging info for Xero routes
    const cookies = request.cookies.getAll();
    // Log in development mode only (edge runtime compatible)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname} [${requestId}]`);
      console.log('[Middleware] Cookies:', cookies.map(c => c.name));
    }
  }
  
  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match test routes
    '/test/:path*',
    // Match Xero-specific routes that might need cookie handling
    '/bookkeeping/:path*',
  ],
};
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

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/api/v1/xero/auth',
  '/api/v1/xero/auth/callback',
  '/api/v1/auth/session',
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/_next',
  '/favicon.ico',
  '/public'
]

// Routes that are protected and require authentication
const PROTECTED_ROUTES = [
  '/',
  '/finance',
  '/bookkeeping',
  '/analytics',
  '/cashflow',
  '/database',
  '/connect',
  '/setup'
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Check if route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route)
  );
  
  // If it's a protected route and not public, check authentication
  if (isProtectedRoute && !isPublicRoute) {
    // Check for user_session cookie
    const userSession = request.cookies.get('user_session');
    
    // Check for authentication
    if (!userSession) {
      console.log(`[Middleware] No user session found for ${pathname}, redirecting to login`);
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      // Store the original URL to redirect back after login
      url.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(url);
    }
  }
  
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
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  
  // Add a custom header to track if this is an API route
  if (request.nextUrl.pathname.startsWith('/api/')) {
    requestHeaders.set('x-api-route', 'true');
  }
  
  // Create response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // For API routes, ensure cookies are properly forwarded
  if (request.nextUrl.pathname.startsWith('/api/v1/xero/')) {
    // Log cookie debugging info for Xero routes
    const cookies = request.cookies.getAll();
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`);
    console.log('[Middleware] Cookies:', cookies.map(c => c.name));
  }
  
  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match Xero-specific routes that might need cookie handling
    '/bookkeeping/:path*',
  ],
};
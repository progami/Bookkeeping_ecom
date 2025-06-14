import { NextRequest, NextResponse } from 'next/server';
import { rateLimiterManager } from '@/lib/xero-rate-limiter';

interface RateLimitError {
  error: string;
  message: string;
  retryAfter?: number;
  rateLimitInfo?: any;
}

export async function withXeroRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  // Extract tenant ID from the request or session
  const tenantId = request.headers.get('x-xero-tenant-id') || 
                   request.cookies.get('xero_tenant_id')?.value;
  
  if (!tenantId) {
    // If no tenant ID, proceed without rate limiting
    // The actual API call will handle authentication
    return handler(request);
  }
  
  const rateLimiter = rateLimiterManager.getLimiter(tenantId);
  
  try {
    // Check rate limit status before proceeding
    const status = await rateLimiter.getRateLimitStatus();
    
    // If we're close to limits, add warning headers
    if (status.dailyRemaining < 100) {
      console.warn(`[Rate Limit Warning] Only ${status.dailyRemaining} daily API calls remaining for tenant ${tenantId}`);
    }
    
    if (status.minuteRemaining !== null && status.minuteRemaining < 5) {
      console.warn(`[Rate Limit Warning] Only ${status.minuteRemaining} per-minute API calls remaining for tenant ${tenantId}`);
    }
    
    // Execute the handler
    const response = await handler(request);
    
    // Add rate limit headers to response
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Daily-Remaining', status.dailyRemaining.toString());
    if (status.minuteRemaining !== null) {
      headers.set('X-RateLimit-Minute-Remaining', status.minuteRemaining.toString());
    }
    
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
    
  } catch (error: any) {
    // Handle rate limit errors
    if (error.message?.includes('Daily API limit') || 
        error.message?.includes('Rate limited') ||
        error.response?.status === 429) {
      
      const retryAfter = error.response?.headers?.['retry-after'] || 60;
      const status = await rateLimiter.getRateLimitStatus();
      
      const errorResponse: RateLimitError = {
        error: 'Rate limit exceeded',
        message: error.message || 'Too many requests to Xero API',
        retryAfter: parseInt(retryAfter),
        rateLimitInfo: status
      };
      
      return NextResponse.json(errorResponse, { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Daily-Remaining': status.dailyRemaining.toString(),
          'X-RateLimit-Daily-Used': status.dailyUsed.toString()
        }
      });
    }
    
    // Re-throw other errors
    throw error;
  }
}

// Helper to extract tenant ID from various sources
export async function getTenantId(request: NextRequest): Promise<string | null> {
  // Try header first
  const headerTenantId = request.headers.get('x-xero-tenant-id');
  if (headerTenantId) return headerTenantId;
  
  // Try cookie
  const cookieTenantId = request.cookies.get('xero_tenant_id')?.value;
  if (cookieTenantId) return cookieTenantId;
  
  // Try to get from Xero session
  try {
    const xeroToken = request.cookies.get('xero_token')?.value;
    if (xeroToken) {
      const tokenData = JSON.parse(xeroToken);
      // Assuming the token contains tenant info
      return tokenData.tenantId || null;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return null;
}
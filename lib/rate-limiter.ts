import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from './logger';

// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`;
  }

  check(
    identifier: string,
    endpoint: string,
    limit: number,
    windowMs: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.getKey(identifier, endpoint);
    const now = Date.now();
    const resetTime = now + windowMs;

    let entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = { count: 0, resetTime };
      this.store.set(key, entry);
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Rate limit configurations per endpoint
const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  '/api/v1/xero/auth': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  '/api/v1/xero/auth/callback': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
  '/api/v1/xero/disconnect': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes

  // Sync endpoints - very limited
  '/api/v1/xero/sync': { limit: 2, windowMs: 60 * 60 * 1000 }, // 2 per hour
  '/api/v1/xero/sync/full': { limit: 1, windowMs: 60 * 60 * 1000 }, // 1 per hour

  // Status endpoints - moderate limits
  '/api/v1/xero/status': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute
  '/api/v1/database/status': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute

  // Report endpoints - reasonable limits
  '/api/v1/xero/reports': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute
  '/api/v1/bookkeeping': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute
  '/api/v1/analytics': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute

  // Default for all other endpoints
  default: { limit: 100, windowMs: 60 * 1000 } // 100 per minute
};

export interface RateLimitOptions {
  identifier?: string;
  limit?: number;
  windowMs?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const pathname = req.nextUrl.pathname;
    
    // Get identifier (IP address or user ID)
    const identifier = options.identifier || 
      req.headers.get('x-forwarded-for')?.split(',')[0] || 
      req.headers.get('x-real-ip') || 
      'anonymous';

    // Find matching rate limit config
    let config = RATE_LIMITS.default;
    for (const [path, limits] of Object.entries(RATE_LIMITS)) {
      if (pathname.startsWith(path)) {
        config = limits;
        break;
      }
    }

    // Override with custom options if provided
    const limit = options.limit || config.limit;
    const windowMs = options.windowMs || config.windowMs;

    // Check rate limit
    const result = rateLimiter.check(identifier, pathname, limit, windowMs);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      structuredLogger.warn('Rate limit exceeded', {
        component: 'rate-limiter',
        identifier,
        endpoint: pathname,
        limit,
        windowMs
      });

      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    try {
      // Call the original handler
      const response = await handler(req);

      // Copy rate limit headers to response
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });

      return response;
    } catch (error) {
      // Still count failed requests unless skipFailedRequests is true
      if (!options.skipFailedRequests) {
        structuredLogger.error('Request failed after rate limit check', error, {
          component: 'rate-limiter',
          endpoint: pathname
        });
      }
      throw error;
    }
  };
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    rateLimiter.destroy();
  });
}
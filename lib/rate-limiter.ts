import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from './logger';
import { redis } from './redis';

// Enhanced rate limiter with Redis support
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private inMemoryStore: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  private useRedis: boolean = false;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Check if Redis is available
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      await redis.ping();
      this.useRedis = true;
      structuredLogger.info('Rate limiter using Redis');
    } catch (error) {
      this.useRedis = false;
      structuredLogger.warn('Rate limiter falling back to in-memory store', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private cleanup() {
    if (!this.useRedis) {
      const now = Date.now();
      for (const [key, entry] of this.inMemoryStore.entries()) {
        if (entry.resetTime < now) {
          this.inMemoryStore.delete(key);
        }
      }
    }
    // Redis handles TTL automatically
  }

  private getKey(identifier: string, endpoint: string): string {
    return `ratelimit:${identifier}:${endpoint}`;
  }

  async check(
    identifier: string,
    endpoint: string,
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.getKey(identifier, endpoint);
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const resetTime = (window + 1) * windowMs;

    if (this.useRedis) {
      try {
        // Use Redis with sliding window approach
        const redisKey = `${key}:${window}`;
        const ttl = Math.ceil(windowMs / 1000);

        // Increment counter
        const count = await redis.incr(redisKey);
        
        // Set expiry on first increment
        if (count === 1) {
          await redis.expire(redisKey, ttl);
        }

        const allowed = count <= limit;
        const remaining = Math.max(0, limit - count);

        return { allowed, remaining, resetTime };
      } catch (error) {
        // Fallback to in-memory on Redis error
        structuredLogger.error('Redis rate limit error, falling back to in-memory', error);
        this.useRedis = false;
      }
    }

    // In-memory fallback
    let entry = this.inMemoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = { count: 0, resetTime };
      this.inMemoryStore.set(key, entry);
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
// Based on Xero API limits:
// - 60 calls per minute (rolling window)
// - 5,000 calls per day (rolling 24-hour window, resets at midnight UTC)
// - 5 concurrent requests maximum
// - 10,000 calls per minute across all tenants (app-wide limit)
// 
// We use conservative limits (30-50% of Xero's limit) to ensure we never hit 429 errors
const RATE_LIMITS = {
  // Authentication endpoints - strict limits to prevent abuse
  '/api/v1/xero/auth': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes
  '/api/v1/xero/auth/callback': { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 per 15 minutes
  '/api/v1/xero/disconnect': { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 per 15 minutes

  // Xero API endpoints - must respect Xero's 60/minute limit
  // We use lower limits to leave headroom for concurrent requests
  '/api/v1/xero/sync': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute (50% of Xero limit)
  '/api/v1/xero/sync/full': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  '/api/v1/xero/reports': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  '/api/v1/xero/status': { limit: 30, windowMs: 60 * 1000 }, // 30 per minute
  '/api/v1/xero/invoices': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute
  '/api/v1/xero/transactions': { limit: 20, windowMs: 60 * 1000 }, // 20 per minute

  // Local endpoints - can have higher limits
  '/api/v1/database/status': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute
  '/api/v1/bookkeeping': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute (local DB queries)
  '/api/v1/analytics': { limit: 60, windowMs: 60 * 1000 }, // 60 per minute (local DB queries)

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
    const result = await rateLimiter.check(identifier, pathname, limit, windowMs);

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

      // Copy rate limit headers to response if response exists
      if (response && response.headers) {
        headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
      }

      return response;
    } catch (error) {
      // Still count failed requests unless skipFailedRequests is true
      if (!options.skipFailedRequests) {
        structuredLogger.error('Request failed after rate limit check', error, {
          component: 'rate-limiter',
          endpoint: pathname
        });
      }
      
      // Re-throw the error so it can be handled by the global error handler
      throw error;
    } finally {
      // In case the error handler returns a response, try to add headers
      // This is wrapped in try-catch to prevent secondary errors
      try {
        if (headers && headers.size > 0) {
          // Headers will be added by the error handler if it creates a response
        }
      } catch (e) {
        // Ignore header errors in finally block
      }
    }
  };
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    rateLimiter.destroy();
  });
}

// Export Bottleneck for use in other modules
export { default as Bottleneck } from 'bottleneck';
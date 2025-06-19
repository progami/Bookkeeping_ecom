import Bottleneck from 'bottleneck';
import { redis } from '@/lib/redis';
import { Logger } from '@/lib/logger';

const logger = new Logger({ module: 'xero-rate-limiter' });

// Xero API Rate Limits:
// - 60 calls per minute
// - 5000 calls per day
// - 5 concurrent requests per tenant

export class XeroRateLimiter {
  private limiter: Bottleneck;
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    
    logger.info(`[XeroRateLimiter] Initializing rate limiter for tenant ${tenantId} with Redis backing`);
    
    // Get Redis connection options from environment
    const redisUrl = process.env.REDIS_URL;
    const redisOptions = redisUrl ? 
      redisUrl : 
      {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      };
    
    // Create a Bottleneck limiter with Xero's rate limits
    this.limiter = new Bottleneck({
      // Per minute limit - be conservative to avoid hitting limits
      reservoir: 50, // Leave buffer of 10 requests
      reservoirRefreshAmount: 50,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
      
      // Maximum concurrent requests per tenant
      maxConcurrent: 2, // Reduce concurrent requests
      
      // Minimum time between requests (1200ms = 50 requests/minute max)
      minTime: 1200,
      
      // Use Redis for distributed rate limiting across instances
      datastore: 'ioredis',
      clearDatastore: false, // Don't clear on startup - preserve rate limits
      clientOptions: redisOptions,
      id: `bookkeeping:xero-limiter-${tenantId}`, // Unique ID per tenant with prefix
    });

    // Track daily usage
    this.setupDailyLimitTracking();
    
    // Add error handling for Bottleneck Redis errors
    this.limiter.on('error', (error) => {
      logger.error(`[XeroRateLimiter] Bottleneck Redis error for tenant ${tenantId}:`, error);
    });
    
    // Log when connected
    this.limiter.ready().then(() => {
      logger.info(`[XeroRateLimiter] Successfully connected to Redis for tenant ${tenantId}`);
    }).catch((error) => {
      logger.error(`[XeroRateLimiter] Failed to connect to Redis for tenant ${tenantId}:`, error);
    });
  }

  private async setupDailyLimitTracking() {
    // Reset daily counter at midnight
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    // Schedule daily reset
    setTimeout(() => {
      this.resetDailyCounter();
      // Then reset every 24 hours
      setInterval(() => this.resetDailyCounter(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  private async resetDailyCounter() {
    const key = `bookkeeping:xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
    await redis.set(key, '0', 'EX', 86400); // Expire after 24 hours
    logger.info(`[XeroRateLimiter] Reset daily counter for tenant ${this.tenantId}`);
  }

  private async checkDailyLimit(): Promise<boolean> {
    const key = `bookkeeping:xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
    const count = await redis.incr(key);
    
    if (count > 5000) {
      await redis.decr(key); // Revert the increment
      return false;
    }
    
    // Set expiry if this is the first request of the day
    if (count === 1) {
      await redis.expire(key, 86400);
    }
    
    return true;
  }

  async executeAPICall<T>(apiFunction: () => Promise<T>): Promise<T> {
    // Check daily limit first
    const withinDailyLimit = await this.checkDailyLimit();
    if (!withinDailyLimit) {
      throw new Error('Daily API limit (5000) reached. Please use export mode or wait until tomorrow.');
    }

    // Use Bottleneck to handle per-minute and concurrent limits
    return this.limiter.schedule(async () => {
      try {
        const result = await apiFunction();
        
        // Extract rate limit headers if available
        if (result && typeof result === 'object' && 'headers' in result) {
          const headers = (result as any).headers;
          if (headers) {
            await this.storeRateLimitInfo(headers);
          }
        }
        
        return result;
      } catch (error: any) {
        // Handle rate limit errors
        if (error.response?.status === 429 || error.response?.statusCode === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          logger.info(`Rate limit hit. Retry after ${retryAfter} seconds`);
          
          // Wait for the retry period plus a buffer
          await new Promise(resolve => setTimeout(resolve, (retryAfter + 2) * 1000));
          
          // Retry the request
          return this.executeAPICall(apiFunction);
        }
        
        // Re-throw other errors
        throw error;
      }
    });
  }

  private async storeRateLimitInfo(headers: any) {
    const remaining = headers['x-rate-limit-remaining'];
    const limit = headers['x-rate-limit-limit'];
    const problem = headers['x-rate-limit-problem'];
    
    if (remaining !== undefined) {
      await redis.set(`bookkeeping:xero:rate:remaining:${this.tenantId}`, remaining, 'EX', 60);
    }
    
    if (problem) {
      logger.warn(`[XeroRateLimiter] Rate limit problem for tenant ${this.tenantId}: ${problem}`);
      await redis.set(`bookkeeping:xero:rate:problem:${this.tenantId}`, problem, 'EX', 300);
    }
  }

  async getRateLimitStatus() {
    const key = `bookkeeping:xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
    const dailyUsed = parseInt(await redis.get(key) || '0');
    const remaining = await redis.get(`bookkeeping:xero:rate:remaining:${this.tenantId}`);
    const problem = await redis.get(`bookkeeping:xero:rate:problem:${this.tenantId}`);
    
    return {
      dailyUsed,
      dailyRemaining: 5000 - dailyUsed,
      minuteRemaining: remaining ? parseInt(remaining) : null,
      problem,
      limiterInfo: await this.limiter.currentReservoir(),
    };
  }

  // Batch API calls efficiently
  async executeBatch<T>(apiFunctions: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(
      apiFunctions.map(fn => this.executeAPICall(fn))
    );
  }

  // Priority queue for critical API calls
  async executePriority<T>(apiFunction: () => Promise<T>): Promise<T> {
    return this.limiter.schedule({ priority: 1 }, async () => {
      const withinDailyLimit = await this.checkDailyLimit();
      if (!withinDailyLimit) {
        throw new Error('Daily API limit reached');
      }
      return apiFunction();
    });
  }

  // Get the underlying Bottleneck limiter
  getLimiter(): Bottleneck {
    return this.limiter;
  }
}

// Singleton manager for rate limiters per tenant
class RateLimiterManager {
  private limiters: Map<string, XeroRateLimiter> = new Map();

  getLimiter(tenantId: string): XeroRateLimiter {
    if (!this.limiters.has(tenantId)) {
      this.limiters.set(tenantId, new XeroRateLimiter(tenantId));
    }
    return this.limiters.get(tenantId)!;
  }
}

export const rateLimiterManager = new RateLimiterManager();
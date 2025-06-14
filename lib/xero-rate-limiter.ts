import Bottleneck from 'bottleneck';
import { redis } from '@/lib/redis';

// Xero API Rate Limits:
// - 60 calls per minute
// - 5000 calls per day
// - 5 concurrent requests per tenant

export class XeroRateLimiter {
  private limiter: Bottleneck;
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    
    // Create a Bottleneck limiter with Xero's rate limits
    this.limiter = new Bottleneck({
      // Per minute limit
      reservoir: 60,
      reservoirRefreshAmount: 60,
      reservoirRefreshInterval: 60 * 1000, // 1 minute
      
      // Maximum concurrent requests per tenant
      maxConcurrent: 5,
      
      // Minimum time between requests (100ms)
      minTime: 100,
      
      // Use local storage instead of Redis for now to avoid bottleneck issues
      // datastore: 'redis',
      // clearDatastore: false,
      // clientOptions: {
      //   host: process.env.REDIS_HOST || 'localhost',
      //   port: parseInt(process.env.REDIS_PORT || '6379'),
      // },
      id: `xero-limiter-${tenantId}`, // Unique ID per tenant
    });

    // Track daily usage
    this.setupDailyLimitTracking();
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
    const key = `xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
    await redis.set(key, '0', 'EX', 86400); // Expire after 24 hours
  }

  private async checkDailyLimit(): Promise<boolean> {
    const key = `xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
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
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
          console.log(`Rate limit hit. Retry after ${retryAfter} seconds`);
          
          // Bottleneck will handle the retry
          throw new Bottleneck.BottleneckError(`Rate limited. Retry after ${retryAfter}s`);
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
      await redis.set(`xero:rate:remaining:${this.tenantId}`, remaining, 'EX', 60);
    }
    
    if (problem) {
      console.warn(`Xero rate limit problem: ${problem}`);
      await redis.set(`xero:rate:problem:${this.tenantId}`, problem, 'EX', 300);
    }
  }

  async getRateLimitStatus() {
    const key = `xero:daily:${this.tenantId}:${new Date().toISOString().split('T')[0]}`;
    const dailyUsed = parseInt(await redis.get(key) || '0');
    const remaining = await redis.get(`xero:rate:remaining:${this.tenantId}`);
    const problem = await redis.get(`xero:rate:problem:${this.tenantId}`);
    
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
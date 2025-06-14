import { redis } from '@/lib/redis';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  forceRefresh?: boolean; // Force refresh the cache
}

const DEFAULT_TTL = 300; // 5 minutes default cache

export class XeroCache {
  private tenantId: string;
  
  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }
  
  private getCacheKey(type: string, params?: any): string {
    const baseKey = `xero:cache:${this.tenantId}:${type}`;
    if (params) {
      const paramStr = JSON.stringify(params, Object.keys(params).sort());
      return `${baseKey}:${paramStr}`;
    }
    return baseKey;
  }
  
  async get<T>(
    type: string, 
    params?: any,
    fetcher?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const { ttl = DEFAULT_TTL, forceRefresh = false } = options;
    const key = this.getCacheKey(type, params);
    
    // If not forcing refresh, try to get from cache
    if (!forceRefresh) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          console.log(`[Cache HIT] ${type} for tenant ${this.tenantId}`);
          return JSON.parse(cached);
        }
      } catch (error) {
        console.error('[Cache] Error reading from cache:', error);
      }
    }
    
    // Cache miss or force refresh
    if (fetcher) {
      console.log(`[Cache MISS] ${type} for tenant ${this.tenantId} - fetching fresh data`);
      try {
        const data = await fetcher();
        await this.set(type, data, params, ttl);
        return data;
      } catch (error) {
        // If fetch fails, try to return stale cache if available
        if (!forceRefresh) {
          const staleCache = await redis.get(key);
          if (staleCache) {
            console.log(`[Cache] Returning stale data for ${type} due to fetch error`);
            return JSON.parse(staleCache);
          }
        }
        throw error;
      }
    }
    
    return null;
  }
  
  async set<T>(type: string, data: T, params?: any, ttl: number = DEFAULT_TTL): Promise<void> {
    const key = this.getCacheKey(type, params);
    try {
      await redis.set(key, JSON.stringify(data), 'EX', ttl);
      console.log(`[Cache SET] ${type} for tenant ${this.tenantId} with TTL ${ttl}s`);
    } catch (error) {
      console.error('[Cache] Error writing to cache:', error);
    }
  }
  
  async invalidate(type: string, params?: any): Promise<void> {
    const key = this.getCacheKey(type, params);
    try {
      await redis.del(key);
      console.log(`[Cache INVALIDATED] ${type} for tenant ${this.tenantId}`);
    } catch (error) {
      console.error('[Cache] Error invalidating cache:', error);
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const basePattern = `xero:cache:${this.tenantId}:${pattern}*`;
      const keys = await redis.keys(basePattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`[Cache INVALIDATED] ${keys.length} keys matching pattern ${pattern}`);
      }
    } catch (error) {
      console.error('[Cache] Error invalidating pattern:', error);
    }
  }
  
  // Cache types with specific TTLs
  static readonly CACHE_TYPES = {
    ORGANISATION: { key: 'organisation', ttl: 3600 }, // 1 hour
    ACCOUNTS: { key: 'accounts', ttl: 1800 }, // 30 minutes
    BANK_ACCOUNTS: { key: 'bank_accounts', ttl: 900 }, // 15 minutes
    BALANCE_SHEET: { key: 'balance_sheet', ttl: 600 }, // 10 minutes
    PROFIT_LOSS: { key: 'profit_loss', ttl: 600 }, // 10 minutes
    TRIAL_BALANCE: { key: 'trial_balance', ttl: 600 }, // 10 minutes
    VENDORS: { key: 'vendors', ttl: 1800 }, // 30 minutes
    VAT_LIABILITY: { key: 'vat_liability', ttl: 600 }, // 10 minutes
    CASH_BALANCE: { key: 'cash_balance', ttl: 300 }, // 5 minutes
  };
}

// Singleton manager for cache instances per tenant
class CacheManager {
  private caches: Map<string, XeroCache> = new Map();
  
  getCache(tenantId: string): XeroCache {
    if (!this.caches.has(tenantId)) {
      this.caches.set(tenantId, new XeroCache(tenantId));
    }
    return this.caches.get(tenantId)!;
  }
}

export const cacheManager = new CacheManager();
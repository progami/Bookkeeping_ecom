import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';
import { executeXeroAPICall, paginatedXeroAPICall } from '@/lib/xero-client-with-rate-limit';
import { Bottleneck } from '@/lib/rate-limiter';

/**
 * Cache key types for different Xero data
 */
export enum CacheKey {
  PROFIT_LOSS = 'profit_loss',
  BALANCE_SHEET = 'balance_sheet',
  VAT_LIABILITY = 'vat_liability',
  ACCOUNTS = 'accounts',
  ACCOUNT_BALANCES = 'account_balances',
  BANK_ACCOUNTS = 'bank_accounts',
  GL_ACCOUNTS = 'gl_accounts',
  INVOICES = 'invoices',
  BILLS = 'bills',
  CONTACTS = 'contacts'
}

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tenantId: string;
  userId: string;
}

/**
 * Xero data cache service
 * Implements single data fetch strategy to prevent repeated API calls
 */
export class XeroDataCache {
  private static instance: XeroDataCache;
  private cache: Map<string, CacheEntry<any>>;
  private refreshInProgress: Map<string, Promise<any>>;
  private limiter: Bottleneck;

  private constructor() {
    this.cache = new Map();
    this.refreshInProgress = new Map();
    
    // Rate limiter for cache operations
    this.limiter = new Bottleneck({
      maxConcurrent: 5,
      minTime: 100
    });
    
    // Clear cache periodically (every hour)
    setInterval(() => this.cleanupExpiredEntries(), 60 * 60 * 1000);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): XeroDataCache {
    if (!XeroDataCache.instance) {
      XeroDataCache.instance = new XeroDataCache();
    }
    return XeroDataCache.instance;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(key: CacheKey, tenantId: string, userId: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${key}:${tenantId}:${userId}:${paramStr}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isValidEntry(entry: CacheEntry<any>, maxAge: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    return (now - entry.timestamp) < maxAge;
  }

  /**
   * Get cached data or fetch from Xero
   */
  public async get<T>(
    key: CacheKey,
    tenantId: string,
    userId: string,
    fetcher: () => Promise<T>,
    params?: any,
    maxAge?: number
  ): Promise<T> {
    const cacheKey = this.getCacheKey(key, tenantId, userId, params);
    
    // Check if data exists in cache
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValidEntry(cached, maxAge)) {
      structuredLogger.debug('Cache hit', {
        component: 'xero-data-cache',
        key,
        tenantId,
        userId
      });
      return cached.data;
    }
    
    // Check if refresh is already in progress
    const inProgress = this.refreshInProgress.get(cacheKey);
    if (inProgress) {
      structuredLogger.debug('Waiting for in-progress fetch', {
        component: 'xero-data-cache',
        key,
        tenantId,
        userId
      });
      return inProgress;
    }
    
    // Fetch data with rate limiting
    const fetchPromise = this.limiter.schedule(async () => {
      try {
        structuredLogger.info('Fetching from Xero API', {
          component: 'xero-data-cache',
          key,
          tenantId,
          userId
        });
        
        const data = await fetcher();
        
        // Store in cache
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          tenantId,
          userId
        });
        
        return data;
      } catch (error) {
        structuredLogger.error('Error fetching from Xero', error as Error, {
          component: 'xero-data-cache',
          key,
          tenantId,
          userId
        });
        throw error;
      } finally {
        // Clean up in-progress marker
        this.refreshInProgress.delete(cacheKey);
      }
    });
    
    // Mark as in progress
    this.refreshInProgress.set(cacheKey, fetchPromise);
    
    return fetchPromise;
  }

  /**
   * Invalidate cache entries
   */
  public invalidate(key?: CacheKey, tenantId?: string, userId?: string): void {
    if (!key) {
      // Clear entire cache
      this.cache.clear();
      structuredLogger.info('Cleared entire cache', {
        component: 'xero-data-cache'
      });
      return;
    }
    
    // Clear specific entries
    const pattern = this.getCacheKey(key, tenantId || '*', userId || '*');
    const keysToDelete: string[] = [];
    
    for (const [cacheKey] of this.cache) {
      if (this.matchesPattern(cacheKey, pattern)) {
        keysToDelete.push(cacheKey);
      }
    }
    
    keysToDelete.forEach(k => this.cache.delete(k));
    
    structuredLogger.info('Invalidated cache entries', {
      component: 'xero-data-cache',
      pattern,
      count: keysToDelete.length
    });
  }

  /**
   * Force refresh all data for a user
   */
  public async refreshAll(tenantId: string, userId: string): Promise<void> {
    structuredLogger.info('Starting full cache refresh', {
      component: 'xero-data-cache',
      tenantId,
      userId
    });
    
    const xero = await getXeroClient();
    if (!xero) {
      throw new Error('Xero client not available');
    }
    
    // Define all data fetchers
    const fetchers = [
      {
        key: CacheKey.PROFIT_LOSS,
        fetch: async () => {
          const report = await executeXeroAPICall(() =>
            xero.accountingApi.getReportProfitAndLoss(
              tenantId,
              undefined,
              3,
              'MONTH'
            )
          );
          return report.body;
        }
      },
      {
        key: CacheKey.BALANCE_SHEET,
        fetch: async () => {
          const report = await executeXeroAPICall(() =>
            xero.accountingApi.getReportBalanceSheet(
              tenantId,
              undefined,
              3,
              'MONTH'
            )
          );
          return report.body;
        }
      },
      {
        key: CacheKey.ACCOUNTS,
        fetch: async () => {
          const accounts = await executeXeroAPICall(() =>
            xero.accountingApi.getAccounts(tenantId)
          );
          return accounts.body.accounts;
        }
      },
      {
        key: CacheKey.BANK_ACCOUNTS,
        fetch: async () => {
          const accounts = await executeXeroAPICall(() =>
            xero.accountingApi.getAccounts(tenantId, undefined, 'Type=="BANK"')
          );
          return accounts.body.accounts;
        }
      }
    ];
    
    // Fetch all data in parallel with rate limiting
    const results = await Promise.allSettled(
      fetchers.map(({ key, fetch }) =>
        this.get(key, tenantId, userId, fetch)
      )
    );
    
    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    structuredLogger.info('Cache refresh completed', {
      component: 'xero-data-cache',
      tenantId,
      userId,
      successful,
      failed
    });
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let removed = 0;
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      structuredLogger.info('Cleaned up expired cache entries', {
        component: 'xero-data-cache',
        removed
      });
    }
  }

  /**
   * Check if cache key matches pattern
   */
  private matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/:/g, '\\:') + '$'
    );
    return regex.test(key);
  }

  /**
   * Get cache statistics
   */
  public getStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp
    }));
    
    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const xeroDataCache = XeroDataCache.getInstance();
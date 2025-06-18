import { getXeroClient } from './xero-client';
import { rateLimiterManager } from './xero-rate-limiter';
import { structuredLogger } from './logger';

export interface XeroClientWithRateLimit {
  executeAPICall: <T>(
    tenantId: string,
    apiFunction: (client: any) => Promise<T>
  ) => Promise<T>;
  paginatedAPICall: <T>(
    tenantId: string,
    apiFunction: (client: any, page: number) => Promise<{ body: { [key: string]: T[] } }>,
    resourceKey: string,
    pageSize?: number
  ) => Promise<T[]>;
}

class XeroClientWithRateLimitImpl implements XeroClientWithRateLimit {
  async executeAPICall<T>(
    tenantId: string,
    apiFunction: (client: any) => Promise<T>
  ): Promise<T> {
    try {
      const xeroClient = await getXeroClient();
      const rateLimiter = rateLimiterManager.getLimiter(tenantId);
      
      const result = await rateLimiter.executeAPICall(async () => {
        return apiFunction(xeroClient);
      });
      
      return result;
    } catch (error: any) {
      structuredLogger.error('[XeroAPI] Rate-limited API call failed', error, {
        tenantId,
        error: error.message
      });
      throw error;
    }
  }

  async paginatedAPICall<T>(
    tenantId: string,
    apiFunction: (client: any, page: number) => Promise<{ body: { [key: string]: T[] } }>,
    resourceKey: string,
    pageSize: number = 100
  ): Promise<T[]> {
    const allResults: T[] = [];
    let page = 1;
    let hasMore = true;
    
    const xeroClient = await getXeroClient();
    const rateLimiter = rateLimiterManager.getLimiter(tenantId);
    
    while (hasMore) {
      try {
        const result = await rateLimiter.executeAPICall(async () => {
          return apiFunction(xeroClient, page);
        });
        
        const items = result.body[resourceKey] || [];
        allResults.push(...items);
        
        hasMore = items.length === pageSize;
        page++;
      } catch (error: any) {
        structuredLogger.error('[XeroAPI] Paginated API call failed', error, {
          tenantId,
          page,
          resourceKey,
          error: error.message
        });
        throw error;
      }
    }
    
    return allResults;
  }
}

export const xeroClientWithRateLimit = new XeroClientWithRateLimitImpl();
import { getXeroClient } from './xero-client';
import { rateLimiterManager } from './xero-rate-limiter';
import { structuredLogger } from './logger';

/**
 * Execute a Xero API call with rate limiting
 * This replaces the functionality from the deleted xero-client-with-rate-limit.ts
 */
export async function executeXeroAPICall<T>(
  tenantId: string,
  apiFunction: (client: any) => Promise<T>
): Promise<T> {
  try {
    // Get the Xero client
    const xeroClient = await getXeroClient();
    
    // Get the rate limiter for this tenant
    const rateLimiter = rateLimiterManager.getLimiter(tenantId);
    
    // Execute the API call with rate limiting
    const result = await rateLimiter.executeAPICall(async () => {
      return apiFunction(xeroClient);
    });
    
    return result;
  } catch (error: any) {
    structuredLogger.error('[XeroAPI] API call failed', error, {
      tenantId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Execute paginated Xero API calls with rate limiting
 * This replaces the functionality from the deleted xero-client-with-rate-limit.ts
 */
export async function paginatedXeroAPICall<T>(
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
      
      // Check if there are more pages
      hasMore = items.length === pageSize;
      page++;
      
      structuredLogger.debug(`[XeroAPI] Paginated call - page ${page - 1}`, {
        tenantId,
        resourceKey,
        itemsInPage: items.length,
        totalSoFar: allResults.length
      });
      
    } catch (error: any) {
      structuredLogger.error(`[XeroAPI] Paginated call failed on page ${page}`, error, {
        tenantId,
        resourceKey,
        page,
        error: error.message
      });
      throw error;
    }
  }
  
  structuredLogger.info(`[XeroAPI] Paginated call completed`, {
    tenantId,
    resourceKey,
    totalPages: page - 1,
    totalItems: allResults.length
  });
  
  return allResults;
}

/**
 * Execute paginated Xero API calls with rate limiting as an async generator
 * Returns results as they are fetched for memory efficiency
 */
export async function* paginatedXeroAPICallGenerator<T>(
  tenantId: string,
  apiFunction: (client: any, page: number) => Promise<any>,
  options?: {
    maxPages?: number;
    delayBetweenPages?: number;
  }
): AsyncGenerator<T[], void, unknown> {
  let page = 1;
  let hasMore = true;
  const maxPages = options?.maxPages || 100;
  const delayBetweenPages = options?.delayBetweenPages || 500;
  
  const xeroClient = await getXeroClient();
  const rateLimiter = rateLimiterManager.getLimiter(tenantId);
  
  while (hasMore && page <= maxPages) {
    try {
      const result = await rateLimiter.executeAPICall(async () => {
        return apiFunction(xeroClient, page);
      });
      
      const items = result.items || [];
      hasMore = result.hasMore || false;
      
      if (items.length > 0) {
        yield items;
      }
      
      structuredLogger.debug(`[XeroAPI] Generator page ${page}`, {
        tenantId,
        itemsInPage: items.length,
        hasMore
      });
      
      page++;
      
      // Delay between pages to respect rate limits
      if (hasMore && delayBetweenPages > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenPages));
      }
      
    } catch (error: any) {
      structuredLogger.error(`[XeroAPI] Generator failed on page ${page}`, error, {
        tenantId,
        page,
        error: error.message
      });
      throw error;
    }
  }
  
  structuredLogger.info(`[XeroAPI] Generator completed`, {
    tenantId,
    totalPages: page - 1
  });
}
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
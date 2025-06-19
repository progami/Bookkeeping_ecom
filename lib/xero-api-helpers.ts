import { XeroClient } from 'xero-node';
import { rateLimiterManager } from './xero-rate-limiter';
import { structuredLogger } from './logger';

/**
 * Execute a Xero API call with rate limiting.
 * ACCEPTS a client instance instead of creating one.
 */
export async function executeXeroAPICall<T>(
  xeroClient: XeroClient, // MODIFIED: Accept client as argument
  tenantId: string,
  apiFunction: (client: XeroClient) => Promise<T>
): Promise<T> {
  try {
    const rateLimiter = rateLimiterManager.getLimiter(tenantId);
    return await rateLimiter.executeAPICall(() => apiFunction(xeroClient));
  } catch (error: any) {
    structuredLogger.error('[XeroAPI] API call failed', error, { tenantId, error: error.message });
    throw error;
  }
}

/**
 * Execute paginated Xero API calls.
 * ACCEPTS a client instance.
 */
export async function paginatedXeroAPICall<T>(
  xeroClient: XeroClient, // MODIFIED: Accept client as argument
  tenantId: string,
  apiFunction: (client: XeroClient, page: number) => Promise<{ body: { [key: string]: T[] } }>,
  resourceKey: string,
  pageSize: number = 100
): Promise<T[]> {
  const allResults: T[] = [];
  let page = 1;
  let hasMore = true;
  const rateLimiter = rateLimiterManager.getLimiter(tenantId);
  
  while (hasMore) {
    try {
      const result = await rateLimiter.executeAPICall(() => apiFunction(xeroClient, page));
      const items = result.body[resourceKey] || [];
      allResults.push(...items);
      hasMore = items.length === pageSize;
      page++;
      
      structuredLogger.debug(`[XeroAPI] Paginated call - page ${page - 1}`, {
        tenantId,
        resourceKey,
        itemsInPage: items.length,
        totalSoFar: allResults.length
      });
    } catch (error: any) {
      structuredLogger.error(`[XeroAPI] Paginated call failed on page ${page}`, error, { tenantId, resourceKey });
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
 * Execute paginated Xero API calls as an async generator.
 * ACCEPTS a client instance.
 */
export async function* paginatedXeroAPICallGenerator<T>(
  xeroClient: XeroClient, // MODIFIED: Accept client as argument
  tenantId: string,
  apiFunction: (client: XeroClient, pageNum: number) => Promise<any>,
  options?: { maxPages?: number; delayBetweenPages?: number }
): AsyncGenerator<T[], void, unknown> {
    let page = 1;
    let hasMore = true;
    const maxPages = options?.maxPages || 100;
    const delayBetweenPages = options?.delayBetweenPages || 500;
    const rateLimiter = rateLimiterManager.getLimiter(tenantId);

    while (hasMore && page <= maxPages) {
        try {
            const result = await rateLimiter.executeAPICall(() => apiFunction(xeroClient, page));
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
            if (hasMore && delayBetweenPages > 0) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenPages));
            }
        } catch (error: any) {
            structuredLogger.error(`[XeroAPI] Generator failed on page ${page}`, error);
            throw error;
        }
    }
    
    structuredLogger.info(`[XeroAPI] Generator completed`, {
        tenantId,
        totalPages: page - 1
    });
}
import { XeroClient } from 'xero-node';
import { getXeroClient, getXeroClientWithTenant } from './xero-client';
import { rateLimiterManager } from './xero-rate-limiter';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

export async function executeXeroAPICall<T>(
  tenantId: string,
  apiCall: (xeroClient: XeroClient) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const rateLimiter = rateLimiterManager.getLimiter(tenantId);
  
  let lastError: any;
  let delay = retryOptions.initialDelay!;
  
  for (let attempt = 0; attempt <= retryOptions.maxRetries!; attempt++) {
    try {
      const xeroClient = await getXeroClient();
      
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      // Execute the API call with rate limiting
      const result = await rateLimiter.executeAPICall(async () => {
        return await apiCall(xeroClient);
      });
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error
      if (error.response?.status === 429 || error.message?.includes('Rate limited')) {
        const retryAfter = error.response?.headers?.['retry-after'];
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
        
        console.log(`Rate limit hit. Waiting ${waitTime}ms before retry (attempt ${attempt + 1}/${retryOptions.maxRetries})`);
        
        if (attempt < retryOptions.maxRetries!) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          delay = Math.min(delay * retryOptions.backoffMultiplier!, retryOptions.maxDelay!);
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}

export async function executeXeroAPICallWithTenant<T>(
  apiCall: (xeroClient: XeroClient, tenantId: string) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const xeroData = await getXeroClientWithTenant();
  
  if (!xeroData) {
    throw new Error('Xero client not available');
  }
  
  const { client, tenantId } = xeroData;
  
  return executeXeroAPICall(
    tenantId,
    async (xeroClient) => apiCall(xeroClient, tenantId),
    options
  );
}

// Helper function to handle paginated requests with rate limiting
export async function* paginatedXeroAPICall<T>(
  tenantId: string,
  fetchPage: (xeroClient: XeroClient, page: number) => Promise<{ items: T[], hasMore: boolean }>,
  options: { maxPages?: number; delayBetweenPages?: number } = {}
): AsyncGenerator<T[], void, unknown> {
  const { maxPages = 100, delayBetweenPages = 200 } = options;
  let page = 1;
  let hasMore = true;
  
  while (hasMore && page <= maxPages) {
    const result = await executeXeroAPICall(tenantId, async (xeroClient) => {
      return await fetchPage(xeroClient, page);
    });
    
    yield result.items;
    hasMore = result.hasMore;
    page++;
    
    // Add delay between pages to be respectful of rate limits
    if (hasMore && delayBetweenPages > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenPages));
    }
  }
}

// Batch multiple API calls efficiently
export async function batchXeroAPICalls<T>(
  tenantId: string,
  apiCalls: Array<(xeroClient: XeroClient) => Promise<T>>,
  options: { batchSize?: number; delayBetweenBatches?: number } = {}
): Promise<T[]> {
  const { batchSize = 5, delayBetweenBatches = 1000 } = options;
  const rateLimiter = rateLimiterManager.getLimiter(tenantId);
  const results: T[] = [];
  
  for (let i = 0; i < apiCalls.length; i += batchSize) {
    const batch = apiCalls.slice(i, i + batchSize);
    const xeroClient = await getXeroClient();
    
    if (!xeroClient) {
      throw new Error('Xero client not available');
    }
    
    const batchResults = await rateLimiter.executeBatch(
      batch.map(apiCall => () => apiCall(xeroClient))
    );
    
    results.push(...batchResults);
    
    // Add delay between batches if not the last batch
    if (i + batchSize < apiCalls.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  return results;
}
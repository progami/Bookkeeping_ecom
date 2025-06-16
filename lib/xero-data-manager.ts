import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';
import { executeXeroAPICall } from '@/lib/xero-client-with-rate-limit';
import { XeroDataCache } from '@/lib/xero-data-cache';
import { structuredLogger } from '@/lib/logger';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { redis } from '@/lib/redis';
import { memoryMonitor } from '@/lib/memory-monitor';
import type { 
  XeroAccount, 
  XeroBankTransaction, 
  XeroInvoice, 
  XeroContact, 
  XeroReport 
} from '@/lib/types/xero-reports';

export interface XeroDataSet {
  accounts: XeroAccount[];
  transactions: XeroBankTransaction[];
  invoices: XeroInvoice[];
  contacts: XeroContact[];
  reports: {
    profitLoss?: XeroReport;
    balanceSheet?: XeroReport;
    vatLiability?: XeroReport;
  };
  lastFetch: Date;
  tenantId: string;
}

/**
 * Manages fetching and caching of all Xero data in a single operation
 * Implements the Single Data Fetch Strategy to prevent multiple API calls
 */
export class XeroDataManager {
  private static instance: XeroDataManager;
  private cache: XeroDataCache;
  private fetchInProgress: Map<string, Promise<XeroDataSet>> = new Map();
  
  private constructor() {
    this.cache = XeroDataCache.getInstance();
  }
  
  static getInstance(): XeroDataManager {
    if (!this.instance) {
      this.instance = new XeroDataManager();
    }
    return this.instance;
  }
  
  /**
   * Get all Xero data - either from cache or fetch fresh
   * This is the main entry point for all data access
   */
  async getAllData(tenantId: string, forceRefresh: boolean = false): Promise<XeroDataSet> {
    const cacheKey = `xero:data:${tenantId}`;
    
    // Check if fetch is already in progress
    if (!forceRefresh && this.fetchInProgress.has(tenantId)) {
      structuredLogger.info('Fetch already in progress, waiting...', {
        component: 'xero-data-manager',
        tenantId
      });
      return this.fetchInProgress.get(tenantId)!;
    }
    
    // Try to get from cache first
    if (!forceRefresh) {
      try {
        // Check Redis cache
        if (redis.status === 'ready') {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const data = JSON.parse(cached) as XeroDataSet;
            // Check if cache is still fresh (1 hour)
            const cacheAge = Date.now() - new Date(data.lastFetch).getTime();
            if (cacheAge < 3600000) { // 1 hour
              structuredLogger.info('Returning cached Xero data', {
                component: 'xero-data-manager',
                tenantId,
                cacheAge: Math.floor(cacheAge / 1000) + 's'
              });
              return data;
            }
          }
        }
        
        // Check in-memory cache using XeroDataCache's method
        const memCached = await this.cache.get(
          cacheKey as any, // Cast to match expected enum
          tenantId,
          'system', // userId for system operations
          async () => null, // No fetch function needed for cache check
          undefined,
          0 // No TTL needed for check
        );
        if (memCached) {
          return memCached as XeroDataSet;
        }
      } catch (error) {
        structuredLogger.warn('Cache retrieval failed', {
          component: 'xero-data-manager',
          error
        });
      }
    }
    
    // Fetch fresh data
    const fetchPromise = this.fetchAllData(tenantId);
    this.fetchInProgress.set(tenantId, fetchPromise);
    
    try {
      const data = await fetchPromise;
      
      // Cache the data
      await this.cacheData(cacheKey, data);
      
      return data;
    } finally {
      this.fetchInProgress.delete(tenantId);
    }
  }
  
  /**
   * Force refresh all data
   */
  async refreshAllData(tenantId: string): Promise<XeroDataSet> {
    return this.getAllData(tenantId, true);
  }
  
  /**
   * Get specific data type from cached dataset
   */
  async getAccounts(tenantId: string): Promise<XeroAccount[]> {
    const data = await this.getAllData(tenantId);
    return data.accounts;
  }
  
  async getTransactions(tenantId: string): Promise<XeroBankTransaction[]> {
    const data = await this.getAllData(tenantId);
    return data.transactions;
  }
  
  async getInvoices(tenantId: string): Promise<XeroInvoice[]> {
    const data = await this.getAllData(tenantId);
    return data.invoices;
  }
  
  async getContacts(tenantId: string): Promise<XeroContact[]> {
    const data = await this.getAllData(tenantId);
    return data.contacts;
  }
  
  async getReports(tenantId: string): Promise<XeroDataSet['reports']> {
    const data = await this.getAllData(tenantId);
    return data.reports;
  }
  
  /**
   * Fetch all data from Xero in parallel
   */
  private async fetchAllData(tenantId: string): Promise<XeroDataSet> {
    return memoryMonitor.monitorOperation('xero-fetch-all-data', async () => {
      const startTime = Date.now();
      
      structuredLogger.info('Starting comprehensive Xero data fetch', {
        component: 'xero-data-manager',
        tenantId
      });
      
      const xeroClient = await getXeroClient();
      
      // Fetch all data in parallel with rate limiting consideration
      const [
        accounts,
        transactions,
        invoices,
        contacts,
        profitLoss,
        balanceSheet,
        vatLiability
      ] = await Promise.all([
        // Core data
        this.fetchWithRetry(() => 
          executeXeroAPICall(tenantId, (xeroClient) => xeroClient.accountingApi.getAccounts(tenantId))
        ),
        this.fetchWithRetry(() => 
          executeXeroAPICall(tenantId, (xeroClient) => xeroClient.accountingApi.getBankTransactions(tenantId))
        ),
        this.fetchWithRetry(() => 
          executeXeroAPICall(tenantId, (xeroClient) => xeroClient.accountingApi.getInvoices(tenantId))
        ),
        this.fetchWithRetry(() => 
          executeXeroAPICall(tenantId, (xeroClient) => xeroClient.accountingApi.getContacts(tenantId))
        ),
        
        // Reports
        this.fetchProfitLossReport(tenantId, xeroClient),
        this.fetchBalanceSheetReport(tenantId, xeroClient),
        this.fetchTrialBalanceReport(tenantId, xeroClient) // For VAT calculations
      ]);
      
      const dataSet: XeroDataSet = {
        accounts: accounts?.accounts || [],
        transactions: transactions?.bankTransactions || [],
        invoices: invoices?.invoices || [],
        contacts: contacts?.contacts || [],
        reports: {
          profitLoss,
          balanceSheet,
          vatLiability: vatLiability || balanceSheet // Use balance sheet as fallback for VAT
        },
        lastFetch: new Date(),
        tenantId
      };
      
      const duration = Date.now() - startTime;
      structuredLogger.info('Completed Xero data fetch', {
        component: 'xero-data-manager',
        tenantId,
        duration,
        recordCounts: {
          accounts: dataSet.accounts.length,
          transactions: dataSet.transactions.length,
          invoices: dataSet.invoices.length,
          contacts: dataSet.contacts.length
        }
      });
      
      return dataSet;
    });
  }
  
  /**
   * Fetch Profit & Loss report
   */
  private async fetchProfitLossReport(tenantId: string, xeroClient: any): Promise<XeroReport | null> {
    try {
      const response = await executeXeroAPICall(
        tenantId,
        (xeroClient) => xeroClient.accountingApi.getReportProfitAndLoss(tenantId)
      );
      return response?.body?.reports?.[0] || null;
    } catch (error) {
      structuredLogger.warn('Failed to fetch P&L report', {
        component: 'xero-data-manager',
        error
      });
      return null;
    }
  }

  /**
   * Fetch Balance Sheet report
   */
  private async fetchBalanceSheetReport(tenantId: string, xeroClient: any): Promise<XeroReport | null> {
    try {
      const response = await executeXeroAPICall(
        tenantId,
        (xeroClient) => xeroClient.accountingApi.getReportBalanceSheet(tenantId)
      );
      return response?.body?.reports?.[0] || null;
    } catch (error) {
      structuredLogger.warn('Failed to fetch Balance Sheet report', {
        component: 'xero-data-manager',
        error
      });
      return null;
    }
  }

  /**
   * Fetch Trial Balance report (for VAT calculations)
   */
  private async fetchTrialBalanceReport(tenantId: string, xeroClient: any): Promise<XeroReport | null> {
    try {
      const response = await executeXeroAPICall(
        tenantId,
        (xeroClient) => xeroClient.accountingApi.getReportTrialBalance(
          tenantId,
          new Date().toISOString().split('T')[0] // Today's date
        )
      );
      return response?.body?.reports?.[0] || null;
    } catch (error) {
      structuredLogger.warn('Failed to fetch Trial Balance report', {
        component: 'xero-data-manager',
        error
      });
      return null;
    }
  }
  
  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry<T>(fetchFn: () => Promise<T>, retries: number = 3): Promise<T | null> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fetchFn();
      } catch (error: any) {
        if (i === retries - 1) {
          structuredLogger.error('Fetch failed after retries', error, {
            component: 'xero-data-manager',
            retries
          });
          return null;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    return null;
  }
  
  /**
   * Cache data in both Redis and memory
   */
  private async cacheData(key: string, data: XeroDataSet): Promise<void> {
    try {
      // Cache in Redis with 1 hour TTL
      if (redis.status === 'ready') {
        await redis.setex(key, 3600, JSON.stringify(data));
      }
      
      // Cache in memory - XeroDataCache manages its own TTL internally
      // We'll store it using the get method with a fetch function that returns the data
      await this.cache.get(
        key as any,
        data.tenantId,
        'system',
        async () => data,
        undefined,
        1800000 // 30 min TTL
      );
      
      structuredLogger.info('Cached Xero data', {
        component: 'xero-data-manager',
        key,
        tenantId: data.tenantId
      });
    } catch (error) {
      structuredLogger.warn('Failed to cache data', {
        component: 'xero-data-manager',
        error
      });
    }
  }
  
  /**
   * Clear cache for a tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    const cacheKey = `xero:data:${tenantId}`;
    
    try {
      if (redis.status === 'ready') {
        await redis.del(cacheKey);
      }
      // XeroDataCache doesn't have a clear method for specific keys
      // It manages its own cache internally
      
      structuredLogger.info('Cleared cache for tenant', {
        component: 'xero-data-manager',
        tenantId
      });
    } catch (error) {
      structuredLogger.warn('Failed to clear cache', {
        component: 'xero-data-manager',
        error
      });
    }
  }
}

// Export singleton instance
export const xeroDataManager = XeroDataManager.getInstance();
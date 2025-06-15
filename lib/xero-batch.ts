import { XeroClient } from 'xero-node';
import { structuredLogger } from './logger';
import { XeroRateLimiter } from './xero-rate-limiter';

// Batch configuration
const BATCH_SIZES = {
  invoices: 50,      // Xero allows up to 50 invoices per batch
  contacts: 50,      // Xero allows up to 50 contacts per batch
  bankTransactions: 50,
  accounts: 100,     // Read operations can handle more
  default: 50
};

export class XeroBatchProcessor {
  private client: XeroClient;
  private tenantId: string;
  private rateLimiter: any;

  constructor(client: XeroClient, tenantId: string) {
    this.client = client;
    this.tenantId = tenantId;
    this.rateLimiter = new XeroRateLimiter(tenantId).getLimiter();
  }

  // Batch fetch invoices with pagination
  async batchFetchInvoices(modifiedSince?: Date): Promise<any[]> {
    const allInvoices: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      try {
        await this.rateLimiter.schedule(async () => {
          const response = await this.client.accountingApi.getInvoices(
            this.tenantId,
            modifiedSince,
            undefined, // where
            undefined, // order
            undefined, // IDs
            undefined, // invoiceNumbers
            undefined, // contactIDs
            undefined, // statuses
            page,
            true, // includeArchived
            undefined, // createdByMyApp
            undefined, // unitdp
            undefined, // summaryOnly
            BATCH_SIZES.invoices // pageSize
          );
          
          const invoices = response.body.invoices || [];
          allInvoices.push(...invoices);
          
          // Check if there are more pages
          hasMore = invoices.length === BATCH_SIZES.invoices;
          page++;
          
          structuredLogger.info('Batch fetched invoices', {
            component: 'xero-batch',
            page: page - 1,
            count: invoices.length,
            total: allInvoices.length
          });
        });
      } catch (error) {
        structuredLogger.error('Failed to batch fetch invoices', error, {
          component: 'xero-batch',
          page
        });
        hasMore = false;
      }
    }
    
    return allInvoices;
  }

  // Batch fetch bank transactions
  async batchFetchBankTransactions(
    bankAccountId: string,
    modifiedSince?: Date
  ): Promise<any[]> {
    const allTransactions: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      try {
        await this.rateLimiter.schedule(async () => {
          const response = await this.client.accountingApi.getBankTransactions(
            this.tenantId,
            modifiedSince,
            `BankAccount.AccountID=GUID("${bankAccountId}")`, // where filter
            undefined, // order
            page,
            BATCH_SIZES.bankTransactions
          );
          
          const transactions = response.body.bankTransactions || [];
          allTransactions.push(...transactions);
          
          hasMore = transactions.length === BATCH_SIZES.bankTransactions;
          page++;
          
          structuredLogger.info('Batch fetched bank transactions', {
            component: 'xero-batch',
            bankAccountId,
            page: page - 1,
            count: transactions.length,
            total: allTransactions.length
          });
        });
      } catch (error) {
        structuredLogger.error('Failed to batch fetch bank transactions', error, {
          component: 'xero-batch',
          bankAccountId,
          page
        });
        hasMore = false;
      }
    }
    
    return allTransactions;
  }

  // Batch fetch contacts
  async batchFetchContacts(modifiedSince?: Date): Promise<any[]> {
    const allContacts: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      try {
        await this.rateLimiter.schedule(async () => {
          const response = await this.client.accountingApi.getContacts(
            this.tenantId,
            modifiedSince,
            undefined, // where
            undefined, // order
            undefined, // IDs
            page,
            true, // includeArchived
            undefined, // summaryOnly
            undefined, // searchTerm
            BATCH_SIZES.contacts // pageSize
          );
          
          const contacts = response.body.contacts || [];
          allContacts.push(...contacts);
          
          hasMore = contacts.length === BATCH_SIZES.contacts;
          page++;
          
          structuredLogger.info('Batch fetched contacts', {
            component: 'xero-batch',
            page: page - 1,
            count: contacts.length,
            total: allContacts.length
          });
        });
      } catch (error) {
        structuredLogger.error('Failed to batch fetch contacts', error, {
          component: 'xero-batch',
          page
        });
        hasMore = false;
      }
    }
    
    return allContacts;
  }

  // Batch create/update operations
  async batchCreateInvoices(invoices: any[]): Promise<any[]> {
    const results: any[] = [];
    const batches = this.createBatches(invoices, BATCH_SIZES.invoices);
    
    for (const [index, batch] of batches.entries()) {
      try {
        await this.rateLimiter.schedule(async () => {
          const response = await this.client.accountingApi.createInvoices(
            this.tenantId,
            { invoices: batch }
          );
          
          results.push(...(response.body.invoices || []));
          
          structuredLogger.info('Batch created invoices', {
            component: 'xero-batch',
            batchIndex: index,
            batchSize: batch.length,
            totalBatches: batches.length
          });
        });
      } catch (error) {
        structuredLogger.error('Failed to batch create invoices', error, {
          component: 'xero-batch',
          batchIndex: index,
          batchSize: batch.length
        });
      }
    }
    
    return results;
  }

  // Helper to create batches
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  // Batch fetch with field filtering
  async batchFetchWithFields(
    endpoint: 'invoices' | 'contacts' | 'bankTransactions',
    fields: string[],
    modifiedSince?: Date
  ): Promise<any[]> {
    // Note: Xero doesn't support field filtering in the API directly
    // We'll fetch full objects and filter fields in memory
    let data: any[] = [];
    
    switch (endpoint) {
      case 'invoices':
        data = await this.batchFetchInvoices(modifiedSince);
        break;
      case 'contacts':
        data = await this.batchFetchContacts(modifiedSince);
        break;
      case 'bankTransactions':
        // Would need bankAccountId for this
        structuredLogger.warn('Bank transactions require bankAccountId for batch fetch', {
          component: 'xero-batch'
        });
        return [];
    }
    
    // Filter fields in memory
    return data.map(item => {
      const filtered: any = {};
      for (const field of fields) {
        if (field in item) {
          filtered[field] = item[field];
        }
      }
      return filtered;
    });
  }
}
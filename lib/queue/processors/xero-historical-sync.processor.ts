import { Job, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { structuredLogger } from '@/lib/logger';
import { HistoricalSyncJob, QUEUE_NAMES, createRedisConnection, PRIORITY_LEVELS } from '../queue-config';
import { updateSyncProgress, completeSyncProgress, failSyncProgress } from '@/lib/sync-progress-manager';
import { withLock, LOCK_RESOURCES } from '@/lib/redis-lock';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { executeXeroAPICall, paginatedXeroAPICallGenerator } from '@/lib/xero-api-helpers';
import { CurrencyService } from '@/lib/currency-service';
import { XeroRateLimiter } from '@/lib/xero-rate-limiter';
import { BankTransaction } from 'xero-node';

// Worker configuration
const WORKER_CONFIG = {
  connection: createRedisConnection(),
  concurrency: 1, // Process one historical sync at a time per architect's recommendation
  maxStalledCount: 1,
  stalledInterval: 300000, // 5 minutes
};

// Checkpoint interface
interface SyncCheckpoint {
  lastCompletedEntity?: string;
  lastProcessedAccountId?: string;
  lastProcessedPage?: number;
  processedCounts?: {
    contacts?: number;
    accounts?: number;
    transactions?: number;
    invoices?: number;
    bills?: number;
  };
  // Enhanced checkpoint data
  lastProcessedContactPage?: number;
  lastProcessedInvoicePage?: number;
  lastProcessedBillPage?: number;
  completedBankAccounts?: string[]; // Track completed bank account IDs
  timestamp?: string;
}

// Load checkpoint from Redis
async function loadCheckpoint(syncId: string): Promise<SyncCheckpoint | null> {
  try {
    const redis = createRedisConnection();
    const key = `sync:checkpoint:${syncId}`;
    const data = await redis.get(key);
    await redis.quit();
    
    return data ? JSON.parse(data) : null;
  } catch (error) {
    structuredLogger.error('Failed to load checkpoint', error, { syncId });
    return null;
  }
}

// Save checkpoint to Redis
async function saveCheckpoint(syncId: string, checkpoint: SyncCheckpoint): Promise<void> {
  try {
    const redis = createRedisConnection();
    const key = `sync:checkpoint:${syncId}`;
    const checkpointWithTimestamp = {
      ...checkpoint,
      timestamp: new Date().toISOString()
    };
    await redis.setex(key, 86400, JSON.stringify(checkpointWithTimestamp)); // 24 hour TTL
    await redis.quit();
    
    // Update sync progress with checkpoint info
    await updateSyncProgress(syncId, {
      checkpoint: {
        lastSaved: checkpointWithTimestamp.timestamp,
        completedEntities: Object.keys(checkpoint.processedCounts || {}).filter(
          entity => (checkpoint.processedCounts as any)[entity] > 0
        )
      }
    });
    
    structuredLogger.info('[Historical Sync Worker] Checkpoint saved', {
      syncId,
      checkpoint: checkpointWithTimestamp
    });
  } catch (error) {
    structuredLogger.error('Failed to save checkpoint', error, { syncId });
  }
}

// Main sync processing function
async function processHistoricalSync(job: Job<HistoricalSyncJob>) {
  const { userId, tenantId, syncId, syncOptions, tokenSet } = job.data;
  const rateLimiter = new XeroRateLimiter();
  
  structuredLogger.info('[Historical Sync Worker] Starting sync', {
    syncId,
    userId,
    tenantId,
    syncOptions
  });

  // Instantiate a new Prisma Client for this specific job
  // Do NOT use the global singleton from lib/prisma.ts as it may not be available in worker context
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./dev.db'
      }
    },
    log: ['error', 'warn']
  });
  
  try {
    // Connect to ensure the client is ready
    await prisma.$connect();
    structuredLogger.info('[Historical Sync Worker] Prisma client connected', { syncId });
    // Update initial progress
    await updateSyncProgress(syncId, {
      status: 'in_progress',
      percentage: 0,
      currentStep: 'Initializing historical sync...',
      steps: {
        contacts: { status: 'pending', count: 0 },
        accounts: { status: 'pending', count: 0 },
        transactions: { status: 'pending', count: 0 },
        invoices: { status: 'pending', count: 0 },
        bills: { status: 'pending', count: 0 }
      }
    });

    // Load checkpoint if exists
    const checkpoint = await loadCheckpoint(syncId);
    if (checkpoint) {
      structuredLogger.info('[Historical Sync Worker] Resuming from checkpoint', {
        syncId,
        checkpoint
      });
      
      await updateSyncProgress(syncId, {
        currentStep: 'Resuming from previous checkpoint...',
        percentage: 5,
        checkpoint: {
          restoredFrom: checkpoint.timestamp,
          completedEntities: Object.keys(checkpoint.processedCounts || {}).filter(
            entity => (checkpoint.processedCounts as any)[entity] > 0
          )
        }
      });
    }

    // Validate token set
    if (!tokenSet) {
      throw new Error('Job is missing required Xero token set');
    }

    // Create Xero client from token set (worker-safe)
    const { createXeroClientFromTokenSet } = await import('@/lib/xero-client');
    const xero = createXeroClientFromTokenSet(tokenSet);
    
    // Update tenants
    await xero.updateTenants();
    if (!xero.tenants || xero.tenants.length === 0) {
      throw new Error('No Xero tenants found');
    }
    
    const tenant = xero.tenants.find(t => t.tenantId === tenantId);
    
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Initialize counters
    let totalAccounts = checkpoint?.processedCounts?.accounts || 0;
    let totalTransactions = checkpoint?.processedCounts?.transactions || 0;
    let totalInvoices = checkpoint?.processedCounts?.invoices || 0;
    let totalBills = checkpoint?.processedCounts?.bills || 0;
    let totalContacts = checkpoint?.processedCounts?.contacts || 0;

    const entitiesToSync = syncOptions.entities;
    const historicalSyncFromDate = new Date(syncOptions.historicalSyncFromDate);

    // REMOVED: Prisma transaction wrapper that was causing issues in worker context
    // Now using the local prisma client directly for all database operations
    
    // Step 1: Sync contacts FIRST to satisfy foreign key constraints
    if (!checkpoint || checkpoint.lastCompletedEntity !== 'contacts') {
      await updateSyncProgress(syncId, {
        currentStep: 'Syncing contacts...',
        percentage: 5,
        steps: {
          contacts: { status: 'in_progress', count: 0 }
        }
      });

      // Resume from last checkpoint page if available
      let currentPage = checkpoint?.lastProcessedContactPage ? checkpoint.lastProcessedContactPage + 1 : 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        const response = await rateLimiter.executeAPICall(
          async () => xero.accountingApi.getContacts(
            tenant.tenantId,
            undefined, // ifModifiedSince
            undefined, // where
            'Name ASC', // order
            undefined, // IDs
            currentPage, // page
            true // includeArchived (set to true to get all contacts)
          )
        );
        
        const contacts = response.body.contacts || [];
        hasMorePages = !!response.body.pagination?.pageCount && currentPage < response.body.pagination.pageCount;
        
        // Batch processing for contacts
        const BATCH_SIZE = 50;
        let contactBatch: any[] = [];
        
        for (const contact of contacts) {
          if (!contact.contactID) continue;
          
          // Add to batch instead of awaiting
          contactBatch.push(
            prisma.contact.upsert({
              where: { xeroContactId: contact.contactID },
              update: {
                name: contact.name || '',
                emailAddress: contact.emailAddress || null,
                firstName: contact.firstName || null,
                lastName: contact.lastName || null,
                isSupplier: contact.isSupplier || false,
                isCustomer: contact.isCustomer || false,
                defaultCurrency: contact.defaultCurrency || null,
                updatedAt: new Date()
              },
              create: {
                xeroContactId: contact.contactID,
                name: contact.name || '',
                emailAddress: contact.emailAddress || null,
                firstName: contact.firstName || null,
                lastName: contact.lastName || null,
                isSupplier: contact.isSupplier || false,
                isCustomer: contact.isCustomer || false,
                defaultCurrency: contact.defaultCurrency || null,
                updatedDateUTC: contact.updatedDateUTC ? new Date(contact.updatedDateUTC) : new Date()
              }
            })
          );
          
          totalContacts++;
          
          // Execute batch when it reaches BATCH_SIZE
          if (contactBatch.length >= BATCH_SIZE) {
            await prisma.$transaction(contactBatch);
            contactBatch = []; // Reset batch
            
            // Update progress after batch
            await updateSyncProgress(syncId, {
              currentStep: `Syncing contacts: ${totalContacts} processed...`,
              percentage: 5 + Math.min(5, (currentPage / 10) * 5),
              steps: {
                contacts: { status: 'in_progress', count: totalContacts }
              }
            });
          }
        }
        
        // Execute any remaining contacts in the batch
        if (contactBatch.length > 0) {
          await prisma.$transaction(contactBatch);
        }
        
        currentPage++;
        
        // Save checkpoint after each page of contacts
        if (hasMorePages) {
          await saveCheckpoint(syncId, {
            ...checkpoint,
            lastProcessedContactPage: currentPage - 1,
            processedCounts: {
              ...checkpoint?.processedCounts,
              contacts: totalContacts
            }
          });
          
          // Add small delay between pages
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Save final checkpoint for contacts
      await saveCheckpoint(syncId, {
        lastCompletedEntity: 'contacts',
        processedCounts: { contacts: totalContacts }
      });

      await updateSyncProgress(syncId, {
        currentStep: 'Contacts synced',
        percentage: 10,
        steps: {
          contacts: { status: 'completed', count: totalContacts }
        }
      });
    }
    
    // Step 2: Sync accounts if needed and not already completed
      if (entitiesToSync.includes('accounts') && 
          (!checkpoint || (checkpoint.lastCompletedEntity === 'contacts'))) {
        
        await updateSyncProgress(syncId, {
          currentStep: 'Syncing Chart of Accounts...',
          percentage: 15,
          steps: {
            accounts: { status: 'in_progress', count: 0 }
          }
        });

        // Sync all accounts (both GL and Bank accounts)
        const allAccountsResponse = await rateLimiter.executeAPICall(
          async () => xero.accountingApi.getAccounts(
            tenant.tenantId,
            undefined,
            undefined,
            'Code ASC'
          )
        );

        const allAccounts = allAccountsResponse.body.accounts || [];
        
        // Separate bank accounts from GL accounts
        const bankAccounts = allAccounts.filter(account => account.type === 'BANK');
        const glAccounts = allAccounts.filter(account => account.type !== 'BANK');
        
        // Process Bank Accounts
        const bankAccountPromises = bankAccounts.map(account => {
          if (!account.accountID || !account.code) return Promise.resolve();
          
          return prisma.bankAccount.upsert({
            where: { xeroAccountId: account.accountID },
            update: {
              name: account.name || '',
              code: account.code,
              currencyCode: account.currencyCode || null,
              status: account.status || null,
              accountNumber: account.bankAccountNumber || null,
              updatedAt: new Date()
            },
            create: {
              xeroAccountId: account.accountID,
              name: account.name || '',
              code: account.code,
              currencyCode: account.currencyCode || null,
              status: account.status || null,
              accountNumber: account.bankAccountNumber || null
            }
          });
        });
        
        // Process GL Accounts - only include fields that exist in the GLAccount model
        const glAccountPromises = glAccounts.map(account => {
          if (!account.code) return Promise.resolve();
          
          return prisma.gLAccount.upsert({
            where: { code: account.code }, // Use 'code' as the unique identifier
            update: {
              name: account.name || '',
              type: account.type || '',
              status: account.status || null,
              description: account.description || null,
              systemAccount: !!account.systemAccount,
              enablePaymentsToAccount: account.enablePaymentsToAccount || false,
              showInExpenseClaims: account.showInExpenseClaims || false,
              class: account.class || null,
              reportingCode: account.reportingCode || null,
              reportingCodeName: account.reportingCodeName || null,
              updatedAt: new Date()
            },
            create: {
              code: account.code,
              name: account.name || '',
              type: account.type || '',
              status: account.status || null,
              description: account.description || null,
              systemAccount: !!account.systemAccount,
              enablePaymentsToAccount: account.enablePaymentsToAccount || false,
              showInExpenseClaims: account.showInExpenseClaims || false,
              class: account.class || null,
              reportingCode: account.reportingCode || null,
              reportingCodeName: account.reportingCodeName || null
            }
          });
        });
        
        // Execute all account upserts in parallel
        await Promise.all([...bankAccountPromises, ...glAccountPromises]);
        totalAccounts = allAccounts.length;

        // Save checkpoint
        await saveCheckpoint(syncId, {
          lastCompletedEntity: 'accounts',
          processedCounts: { 
            contacts: totalContacts,
            accounts: totalAccounts 
          }
        });

        await updateSyncProgress(syncId, {
          currentStep: 'Chart of Accounts synced',
          percentage: 25,
          steps: {
            accounts: { status: 'completed', count: totalAccounts }
          }
        });
      }

      // Step 3: Sync transactions if needed
      if (entitiesToSync.includes('transactions') && 
          (!checkpoint || (checkpoint.lastCompletedEntity === 'accounts'))) {
        
        await updateSyncProgress(syncId, {
          currentStep: 'Syncing transactions...',
          percentage: 30,
          steps: {
            transactions: { status: 'in_progress', count: 0 }
          }
        });

        // FIXED: Optimized transaction sync to avoid N+1 problem
        // Now fetching all transactions in a single paginated call instead of per bank account
        
        const transactionSyncStartTime = Date.now();
        
        // Get all bank accounts first to create a lookup map
        const bankAccountsResponse = await rateLimiter.executeAPICall(
          async () => xero.accountingApi.getAccounts(
            tenant.tenantId,
            undefined,
            'Type=="BANK"',
            'Code ASC'
          )
        );

        const bankAccounts = bankAccountsResponse.body.accounts || [];
        
        // Create bank account lookup map - FIXED N+1 QUERY
        // Fetch ALL bank accounts from database in a single query
        const xeroAccountIds = bankAccounts.map(account => account.accountID!).filter(Boolean);
        const bankAccountRecords = await prisma.bankAccount.findMany({
          where: {
            xeroAccountId: {
              in: xeroAccountIds
            }
          }
        });
        
        // Create lookup map from the batch query results
        const bankAccountMap = new Map<string, any>();
        for (const bankAccountRecord of bankAccountRecords) {
          bankAccountMap.set(bankAccountRecord.xeroAccountId, bankAccountRecord);
        }
        
        // Log any missing bank accounts
        for (const account of bankAccounts) {
          if (!bankAccountMap.has(account.accountID!)) {
            structuredLogger.warn('[Historical Sync Worker] Bank account not found in database', {
              accountId: account.accountID,
              accountName: account.name
            });
          }
        }

        const maxTransactions = syncOptions.limits?.transactions || 10000;
        let transactionsSynced = 0;
        
        // Update progress
        await updateSyncProgress(syncId, {
          currentStep: 'Fetching all bank transactions...',
          percentage: 30,
          steps: {
            transactions: { 
              status: 'in_progress', 
              count: 0,
              details: `Processing all bank accounts (${bankAccounts.length} total)`
            }
          }
        });

        // Fetch ALL transactions with pagination using generator
        const transactionPages = paginatedXeroAPICallGenerator(
          xero,
          tenant.tenantId,
          async (client, pageNum) => {
            const response = await client.accountingApi.getBankTransactions(
              tenant.tenantId,
              historicalSyncFromDate, // Modified since date for historical sync
              undefined, // No account-specific filter - fetch ALL transactions
              'Date ASC', // Chronological order
              undefined, // unitdp
              pageNum,
              100 // Page size
            );
            return {
              items: response.body.bankTransactions || [],
              hasMore: (response.body.bankTransactions || []).length === 100
            };
          }
        );

        // Batch processing for transactions
        const BATCH_SIZE = 100;
        let upsertBatch: any[] = [];
        let processedPages = 0;
        
        // Process the stream of all transactions
        for await (const transactionPage of transactionPages) {
          processedPages++;
          
          // Update progress every few pages
          if (processedPages % 5 === 0) {
            await updateSyncProgress(syncId, {
              currentStep: `Processing transactions (page ${processedPages})...`,
              percentage: 30 + Math.min(35, (transactionsSynced / maxTransactions) * 35),
              steps: {
                transactions: { 
                  status: 'in_progress', 
                  count: transactionsSynced,
                  details: `Processed ${processedPages} pages`
                }
              }
            });
          }
          
          for (const transaction of transactionPage) {
            if (transactionsSynced >= maxTransactions) break;
            
            // Skip if we don't have this bank account in our database
            const bankAccountRecord = bankAccountMap.get(transaction.bankAccount?.accountID || '');
            if (!bankAccountRecord) {
              continue;
            }

            // Add to batch instead of awaiting
            upsertBatch.push(
              prisma.bankTransaction.upsert({
                  where: { xeroTransactionId: transaction.bankTransactionID! },
                  update: {
                    type: transaction.type?.toString() || '',
                    contactId: transaction.contact?.contactID || null,
                    contactName: transaction.contact?.name || null,
                    isReconciled: transaction.isReconciled || false,
                    date: transaction.date ? new Date(transaction.date) : new Date(),
                    reference: transaction.reference || null,
                    description: transaction.lineItems?.[0]?.description || null,
                    accountCode: transaction.lineItems?.[0]?.accountCode || null, // ADD accountCode from line items
                    currencyCode: transaction.currencyCode?.toString() || null,
                    currencyRate: transaction.currencyRate ? parseFloat(transaction.currencyRate.toString()) : null,
                    url: transaction.url || null,
                    status: transaction.status?.toString() || '',
                    lineAmountTypes: transaction.lineAmountTypes?.toString() || null,
                    lineItems: transaction.lineItems ? JSON.stringify(transaction.lineItems) : null,
                    subTotal: transaction.subTotal ? parseFloat(transaction.subTotal.toString()) : 0,
                    totalTax: transaction.totalTax ? parseFloat(transaction.totalTax.toString()) : 0,
                    total: transaction.total ? parseFloat(transaction.total.toString()) : 0,
                    prepaymentId: transaction.prepaymentID || null,
                    overpaymentId: transaction.overpaymentID || null,
                    updatedDateUTC: transaction.updatedDateUTC || new Date(),
                    statusAttributeString: transaction.statusAttributeString || null,
                    hasAttachments: transaction.hasAttachments || false,
                    lastSyncedAt: new Date(),
                    updatedAt: new Date()
                  },
                  create: {
                    xeroTransactionId: transaction.bankTransactionID!,
                    type: transaction.type?.toString() || '',
                    contactId: transaction.contact?.contactID || null,
                    contactName: transaction.contact?.name || null,
                    bankAccountId: bankAccountRecord.id,
                    isReconciled: transaction.isReconciled || false,
                    date: transaction.date ? new Date(transaction.date) : new Date(),
                    reference: transaction.reference || null,
                    description: transaction.lineItems?.[0]?.description || null,
                    accountCode: transaction.lineItems?.[0]?.accountCode || null, // ADD accountCode from line items
                    currencyCode: transaction.currencyCode?.toString() || null,
                    currencyRate: transaction.currencyRate ? parseFloat(transaction.currencyRate.toString()) : null,
                    url: transaction.url || null,
                    status: transaction.status?.toString() || '',
                    lineAmountTypes: transaction.lineAmountTypes?.toString() || null,
                    lineItems: transaction.lineItems ? JSON.stringify(transaction.lineItems) : null,
                    subTotal: transaction.subTotal ? parseFloat(transaction.subTotal.toString()) : 0,
                    totalTax: transaction.totalTax ? parseFloat(transaction.totalTax.toString()) : 0,
                    total: transaction.total ? parseFloat(transaction.total.toString()) : 0,
                    prepaymentId: transaction.prepaymentID || null,
                    overpaymentId: transaction.overpaymentID || null,
                    updatedDateUTC: transaction.updatedDateUTC || new Date(),
                    statusAttributeString: transaction.statusAttributeString || null,
                    hasAttachments: transaction.hasAttachments || false,
                    lastSyncedAt: new Date()
                  }
              })
            );

            transactionsSynced++;
            totalTransactions++;

            // Execute batch when it reaches BATCH_SIZE
            if (upsertBatch.length >= BATCH_SIZE) {
              await prisma.$transaction(upsertBatch);
              upsertBatch = []; // Reset batch
              
              // Save checkpoint periodically
              await saveCheckpoint(syncId, {
                lastProcessedPage: processedPages,
                processedCounts: {
                  contacts: totalContacts,
                  accounts: totalAccounts,
                  transactions: totalTransactions
                }
              });
            }
          }
          
          // Stop if we've reached the limit
          if (transactionsSynced >= maxTransactions) break;
        }
        
        // Execute any remaining transactions in the batch
        if (upsertBatch.length > 0) {
          await prisma.$transaction(upsertBatch);
        }

        // Save final checkpoint for transactions
        await saveCheckpoint(syncId, {
          lastCompletedEntity: 'transactions',
          processedCounts: {
            contacts: totalContacts,
            accounts: totalAccounts,
            transactions: totalTransactions
          }
        });

        await updateSyncProgress(syncId, {
          currentStep: 'Transactions synced',
          percentage: 65,
          steps: {
            transactions: { status: 'completed', count: totalTransactions }
          }
        });
        
        const transactionSyncDuration = Date.now() - transactionSyncStartTime;
        structuredLogger.info('[Historical Sync Worker] Completed all transactions sync', {
          syncId,
          totalTransactions,
          pagesProcessed: processedPages,
          bankAccountsCount: bankAccounts.length,
          duration: transactionSyncDuration,
          durationSeconds: Math.round(transactionSyncDuration / 1000),
          transactionsPerSecond: totalTransactions > 0 ? (totalTransactions / (transactionSyncDuration / 1000)).toFixed(2) : 0
        });
      }

      // Step 4: Sync invoices if needed
      if (entitiesToSync.includes('invoices') && 
          (!checkpoint || (checkpoint.lastCompletedEntity === 'transactions'))) {
        
        await updateSyncProgress(syncId, {
          currentStep: 'Syncing invoices...',
          percentage: 70,
          steps: {
            invoices: { status: 'in_progress', count: 0 }
          }
        });

        const maxInvoices = syncOptions.limits?.invoices || 5000;
        let invoicesSynced = 0;
        let currentPage = checkpoint?.lastProcessedInvoicePage ? checkpoint.lastProcessedInvoicePage + 1 : 1;
        let hasMorePages = true;
        
        // Batch processing for invoices
        const BATCH_SIZE = 50;
        let invoiceBatch: any[] = [];
        
        while (hasMorePages && invoicesSynced < maxInvoices) {
          const response = await rateLimiter.executeAPICall(
            async () => xero.accountingApi.getInvoices(
              tenant.tenantId,
              historicalSyncFromDate,
              undefined,
              'UpdatedDateUTC ASC',
              undefined,
              undefined,
              undefined,
              undefined,
              currentPage
            )
          );
          
          const invoices = response.body.invoices || [];
          hasMorePages = !!response.body.pagination?.pageCount && currentPage < response.body.pagination.pageCount;
          
          for (const invoice of invoices) {
            if (invoice.type === 'ACCREC' && invoicesSynced < maxInvoices) {
              // Add to batch instead of awaiting
              invoiceBatch.push(
                prisma.syncedInvoice.upsert({
                  where: { id: invoice.invoiceID! },
                  update: {
                    type: invoice.type.toString(),
                    contactId: invoice.contact?.contactID || '',
                    contactName: invoice.contact?.name || null,
                    invoiceNumber: invoice.invoiceNumber || null,
                    reference: invoice.reference || null,
                    date: invoice.date ? new Date(invoice.date) : new Date(),
                    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : new Date(),
                    status: invoice.status?.toString() || 'OPEN',
                    lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
                    total: invoice.total ? parseFloat(invoice.total.toString()) : 0,
                    amountDue: invoice.amountDue ? parseFloat(invoice.amountDue.toString()) : parseFloat((invoice.total || 0).toString()),
                    currencyCode: invoice.currencyCode?.toString() || null,
                    lastModifiedUtc: new Date(),
                    updatedAt: new Date()
                  },
                  create: {
                    id: invoice.invoiceID!,
                    type: invoice.type.toString(),
                    contactId: invoice.contact?.contactID || '',
                    contactName: invoice.contact?.name || null,
                    invoiceNumber: invoice.invoiceNumber || null,
                    reference: invoice.reference || null,
                    date: invoice.date ? new Date(invoice.date) : new Date(),
                    dueDate: invoice.dueDate ? new Date(invoice.dueDate) : new Date(),
                    status: invoice.status?.toString() || 'OPEN',
                    lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
                    total: invoice.total ? parseFloat(invoice.total.toString()) : 0,
                    amountDue: invoice.amountDue ? parseFloat(invoice.amountDue.toString()) : parseFloat((invoice.total || 0).toString()),
                    currencyCode: invoice.currencyCode?.toString() || null,
                    lastModifiedUtc: new Date()
                  }
                })
              );
              
              totalInvoices++;
              invoicesSynced++;

              // Execute batch when it reaches BATCH_SIZE
              if (invoiceBatch.length >= BATCH_SIZE) {
                await prisma.$transaction(invoiceBatch);
                invoiceBatch = []; // Reset batch
                
                // Update progress after batch
                await updateSyncProgress(syncId, {
                  currentStep: `Syncing invoices: ${totalInvoices} processed...`,
                  percentage: 70 + Math.min(10, (invoicesSynced / maxInvoices) * 10),
                  steps: {
                    invoices: { 
                      status: 'in_progress', 
                      count: totalInvoices 
                    }
                  }
                });
              }
            }
          }
          
          currentPage++;
          
          // Save checkpoint after each page
          if (hasMorePages) {
            await saveCheckpoint(syncId, {
              ...checkpoint,
              lastProcessedInvoicePage: currentPage - 1,
              processedCounts: {
                contacts: totalContacts,
                accounts: totalAccounts,
                transactions: totalTransactions,
                invoices: totalInvoices
              }
            });
            
            // Add small delay between pages
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Execute any remaining invoices in the batch
        if (invoiceBatch.length > 0) {
          await prisma.$transaction(invoiceBatch);
        }

        // Save checkpoint
        await saveCheckpoint(syncId, {
          lastCompletedEntity: 'invoices',
          processedCounts: {
            contacts: totalContacts,
            accounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices
          }
        });

        await updateSyncProgress(syncId, {
          currentStep: 'Invoices synced',
          percentage: 80,
          steps: {
            invoices: { status: 'completed', count: totalInvoices }
          }
        });
      }

      // Step 5: Sync bills if needed
      if (entitiesToSync.includes('bills') && 
          (!checkpoint || checkpoint.lastCompletedEntity === 'invoices')) {
        
        await updateSyncProgress(syncId, {
          currentStep: 'Syncing bills...',
          percentage: 85,
          steps: {
            bills: { status: 'in_progress', count: 0 }
          }
        });

        const maxBills = syncOptions.limits?.bills || 5000;
        let billsSynced = 0;
        let currentPage = 1;
        let hasMorePages = true;
        
        // Batch processing for bills
        const BATCH_SIZE = 50;
        let billBatch: any[] = [];
        
        while (hasMorePages && billsSynced < maxBills) {
          const response = await rateLimiter.executeAPICall(
            async () => xero.accountingApi.getInvoices(
              tenant.tenantId,
              historicalSyncFromDate,
              undefined,
              'UpdatedDateUTC ASC',
              undefined,
              undefined,
              undefined,
              undefined,
              currentPage
            )
          );
          
          const bills = response.body.invoices || [];
          hasMorePages = !!response.body.pagination?.pageCount && currentPage < response.body.pagination.pageCount;
          
          for (const bill of bills) {
            if (bill.type === 'ACCPAY' && billsSynced < maxBills) {
              // Add to batch instead of awaiting
              billBatch.push(
                prisma.syncedInvoice.upsert({
                  where: { id: bill.invoiceID! },
                  update: {
                    type: bill.type.toString(),
                    contactId: bill.contact?.contactID || '',
                    contactName: bill.contact?.name || null,
                    invoiceNumber: bill.invoiceNumber || null,
                    reference: bill.reference || null,
                    date: bill.date ? new Date(bill.date) : new Date(),
                    dueDate: bill.dueDate ? new Date(bill.dueDate) : new Date(),
                    status: bill.status?.toString() || 'OPEN',
                    lineAmountTypes: bill.lineAmountTypes?.toString() || null,
                    total: bill.total ? parseFloat(bill.total.toString()) : 0,
                    amountDue: bill.amountDue ? parseFloat(bill.amountDue.toString()) : parseFloat((bill.total || 0).toString()),
                    currencyCode: bill.currencyCode?.toString() || null,
                    lastModifiedUtc: new Date(),
                    updatedAt: new Date()
                  },
                  create: {
                    id: bill.invoiceID!,
                    type: bill.type.toString(),
                    contactId: bill.contact?.contactID || '',
                    contactName: bill.contact?.name || null,
                    invoiceNumber: bill.invoiceNumber || null,
                    reference: bill.reference || null,
                    date: bill.date ? new Date(bill.date) : new Date(),
                    dueDate: bill.dueDate ? new Date(bill.dueDate) : new Date(),
                    status: bill.status?.toString() || 'OPEN',
                    lineAmountTypes: bill.lineAmountTypes?.toString() || null,
                    total: bill.total ? parseFloat(bill.total.toString()) : 0,
                    amountDue: bill.amountDue ? parseFloat(bill.amountDue.toString()) : parseFloat((bill.total || 0).toString()),
                    currencyCode: bill.currencyCode?.toString() || null,
                    lastModifiedUtc: new Date()
                  }
                })
              );
              
              totalBills++;
              billsSynced++;

              // Execute batch when it reaches BATCH_SIZE
              if (billBatch.length >= BATCH_SIZE) {
                await prisma.$transaction(billBatch);
                billBatch = []; // Reset batch
                
                // Update progress after batch
                await updateSyncProgress(syncId, {
                  currentStep: `Syncing bills: ${totalBills} processed...`,
                  percentage: 85 + Math.min(10, (billsSynced / maxBills) * 10),
                  steps: {
                    bills: { 
                      status: 'in_progress', 
                      count: totalBills 
                    }
                  }
                });
              }
            }
          }
          
          currentPage++;
          
          // Save checkpoint after each page
          if (hasMorePages) {
            await saveCheckpoint(syncId, {
              ...checkpoint,
              lastProcessedBillPage: currentPage - 1,
              processedCounts: {
                contacts: totalContacts,
                accounts: totalAccounts,  
                transactions: totalTransactions,
                invoices: totalInvoices,
                bills: totalBills
              }
            });
            
            // Add small delay between pages
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Execute any remaining bills in the batch
        if (billBatch.length > 0) {
          await prisma.$transaction(billBatch);
        }

        // Save final checkpoint
        await saveCheckpoint(syncId, {
          lastCompletedEntity: 'bills',
          processedCounts: {
            contacts: totalContacts,
            accounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices,
            bills: totalBills
          }
        });

        await updateSyncProgress(syncId, {
          currentStep: 'Bills synced',
          percentage: 95,
          steps: {
            bills: { status: 'completed', count: totalBills }
          }
        });
      }

    // Mark sync as completed
    await completeSyncProgress(syncId, {
      contacts: totalContacts,
      accounts: totalAccounts,
      transactions: totalTransactions,
      invoices: totalInvoices,
      bills: totalBills
    });
    
    // Update sync log in database
    await prisma.syncLog.update({
      where: { id: syncId },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated: totalTransactions + totalInvoices + totalBills + totalContacts,
        recordsUpdated: 0,
        details: JSON.stringify({
          contacts: totalContacts,
          accounts: totalAccounts,
          transactions: totalTransactions,
          invoices: totalInvoices,
          bills: totalBills
        })
      }
    });

    // Clear checkpoint on success
    const redis = createRedisConnection();
    await redis.del(`sync:checkpoint:${syncId}`);
    await redis.quit();

    structuredLogger.info('[Historical Sync Worker] Sync completed successfully', {
      syncId,
      summary: {
        contacts: totalContacts,
        accounts: totalAccounts,
        transactions: totalTransactions,
        invoices: totalInvoices,
        bills: totalBills
      }
    });

    return {
      success: true,
      syncId,
      summary: {
        contacts: totalContacts,
        accounts: totalAccounts,
        transactions: totalTransactions,
        invoices: totalInvoices,
        bills: totalBills
      }
    };

  } catch (error: any) {
    structuredLogger.error('[Historical Sync Worker] Sync failed catastrophically', error, {
      syncId,
      userId,
      tenantId,
      errorStack: error.stack,
      errorMessage: error.message
    });

    // Update sync status to failed
    await failSyncProgress(syncId, error.message || 'Historical sync failed');
    
    // Update sync log in database
    try {
      await prisma.syncLog.update({
        where: { id: syncId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message || 'Historical sync failed',
          details: JSON.stringify({
            contacts: totalContacts,
            accounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices,
            bills: totalBills,
            error: error.message
          })
        }
      });
    } catch (updateError) {
      structuredLogger.error('[Historical Sync Worker] Failed to update sync log', updateError, { syncId });
    }

    // Re-throw to let BullMQ handle retries
    throw error;
  } finally {
    // CRITICAL: Disconnect the Prisma Client in a finally block
    // This ensures the connection is closed even if the job fails
    await prisma.$disconnect();
    structuredLogger.info('[Historical Sync Worker] Prisma client disconnected', { syncId });
  }
}

// Create the worker
export const historicalSyncWorker = new Worker<HistoricalSyncJob>(
  QUEUE_NAMES.HISTORICAL_SYNC,
  processHistoricalSync,
  WORKER_CONFIG
);

// Worker event handlers
historicalSyncWorker.on('completed', (job) => {
  structuredLogger.info('[Historical Sync Worker] Job completed', {
    jobId: job.id,
    syncId: job.data.syncId
  });
});

historicalSyncWorker.on('failed', (job, err) => {
  structuredLogger.error('[Historical Sync Worker] Job failed', err, {
    jobId: job?.id,
    syncId: job?.data.syncId
  });
});

historicalSyncWorker.on('error', (err) => {
  structuredLogger.error('[Historical Sync Worker] Worker error', err);
});

// Add stalled job handler
historicalSyncWorker.on('stalled', (jobId) => {
  structuredLogger.warn('[Historical Sync Worker] Job stalled', { jobId });
});

// Add additional error boundaries for uncaught exceptions in worker context
process.on('unhandledRejection', (reason, promise) => {
  structuredLogger.error('[Historical Sync Worker] Unhandled Rejection at:', promise, { reason });
  // Don't exit the process - let the job fail and retry
});

// Graceful shutdown
export async function shutdownHistoricalSyncWorker(): Promise<void> {
  await historicalSyncWorker.close();
}
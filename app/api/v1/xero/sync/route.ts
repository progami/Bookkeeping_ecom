import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { BankTransaction } from 'xero-node';
import { executeXeroAPICall, paginatedXeroAPICall, paginatedXeroAPICallGenerator } from '@/lib/xero-api-helpers';
import { structuredLogger } from '@/lib/logger';
import { withIdempotency } from '@/lib/idempotency';
import { withValidation } from '@/lib/validation/middleware';
import { xeroSyncSchema } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/rate-limiter';
import { withLock, LOCK_RESOURCES } from '@/lib/redis-lock';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { CurrencyService } from '@/lib/currency-service';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { memoryMonitor } from '@/lib/memory-monitor';
import { updateSyncProgress, completeSyncProgress, failSyncProgress } from '@/lib/sync-progress-manager';
import { getQueue, QUEUE_NAMES, HistoricalSyncJob, PRIORITY_LEVELS } from '@/lib/queue/queue-config';
import '@/lib/queue/init-workers'; // Initialize workers

export const POST = withRateLimit(
  withAuthValidation(
    { bodySchema: xeroSyncSchema, authLevel: ValidationLevel.XERO },
    async (request, { body, session }) => {
    let syncLog: any;

    try {
      const forceFullSync = body?.forceSync || false;
      const syncOptions = body?.syncOptions || {};
      
      // Log incoming sync request
      structuredLogger.info('[Xero Sync] Manual sync request received', {
        forceFullSync,
        syncOptions,
        userId: session?.user?.userId
      });
      
      // Default to all entities if not specified
      const entitiesToSync = syncOptions.entities || ['accounts', 'transactions', 'invoices', 'bills', 'contacts'];
      const fromDate = syncOptions.fromDate ? new Date(syncOptions.fromDate) : undefined;
      const toDate = syncOptions.toDate ? new Date(syncOptions.toDate) : undefined;
      const historicalSyncFromDate = syncOptions.historicalSyncFromDate ? new Date(syncOptions.historicalSyncFromDate) : undefined;
      const limits = syncOptions.limits || {};
    
    // Get last successful sync for incremental sync
    const lastSuccessfulSync = await prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { completedAt: 'desc' }
    });
    
    // Determine sync type and modifiedSince date
    const isHistoricalSync = !!historicalSyncFromDate;
    const syncType = isHistoricalSync ? 'historical_sync' : (forceFullSync || !lastSuccessfulSync ? 'full_sync' : 'incremental_sync');
    
    // For historical sync, we don't use modifiedSince - we want ALL data from the specified date
    // For incremental sync, we use modifiedSince to get only updated records
    const modifiedSince = isHistoricalSync ? undefined : (!forceFullSync && lastSuccessfulSync?.completedAt || fromDate || undefined);
    
    structuredLogger.info('[Xero Sync] Sync type determined', {
      syncType,
      isHistoricalSync,
      modifiedSince: modifiedSince?.toISOString(),
      historicalSyncFromDate: historicalSyncFromDate?.toISOString(),
      lastSuccessfulSync: lastSuccessfulSync?.completedAt
    });
    
    // For historical sync, enqueue to background queue
    if (isHistoricalSync) {
      // Get Xero client to check tenant and get token
      const xero = await getXeroClient();
      if (!xero) {
        throw new Error('Not connected to Xero');
      }
      
      // Get the token set that the API route can access
      const { getStoredTokenSet } = await import('@/lib/xero-client');
      const tokenSet = await getStoredTokenSet();
      if (!tokenSet || !tokenSet.access_token) {
        throw new Error('Xero token not found. Please reconnect.');
      }
      
      await xero.updateTenants();
      if (!xero.tenants || xero.tenants.length === 0) {
        throw new Error('No Xero tenants found. Please reconnect to Xero.');
      }
      
      const tenant = xero.tenants[0];
      
      // Create sync log
      syncLog = await prisma.syncLog.create({
        data: {
          syncType,
          status: 'in_progress', // Set to in_progress immediately so progress endpoint can find it
          startedAt: new Date()
        }
      });
      
      // Initialize progress in Redis
      await updateSyncProgress(syncLog.id, {
        syncId: syncLog.id,
        status: 'pending',
        percentage: 0,
        currentStep: 'Sync queued for background processing...',
        steps: {},
        startedAt: syncLog.startedAt.toISOString()
      });
      
      // Enqueue job to historical sync queue with token
      const historicalSyncQueue = getQueue<HistoricalSyncJob>(QUEUE_NAMES.HISTORICAL_SYNC);
      const job = await historicalSyncQueue.add(
        'historical-sync',
        {
          userId: session.user.userId,
          tenantId: tenant.tenantId,
          syncId: syncLog.id,
          tokenSet: {
            access_token: tokenSet.access_token,
            refresh_token: tokenSet.refresh_token,
            expires_at: tokenSet.expires_at,
            expires_in: tokenSet.expires_in,
            token_type: tokenSet.token_type,
            scope: tokenSet.scope
          }, // Pass the token set securely
          syncOptions: {
            entities: entitiesToSync,
            historicalSyncFromDate: historicalSyncFromDate.toISOString(),
            limits,
            accountIds: syncOptions.accountIds
          }
        },
        {
          priority: PRIORITY_LEVELS.HIGH,
          removeOnComplete: false,
          removeOnFail: false
        }
      );
      
      structuredLogger.info('[Xero Sync] Historical sync job enqueued', {
        syncId: syncLog.id,
        jobId: job.id,
        tenantId: tenant.tenantId
      });
      
      // Log sync queue
      await auditLogger.logSuccess(
        AuditAction.SYNC_START,
        AuditResource.SYNC_OPERATION,
        {
          resourceId: syncLog.id,
          metadata: {
            syncType,
            jobId: job.id,
            queued: true
          }
        }
      );
      
      return NextResponse.json({
        syncId: syncLog.id,
        status: 'queued',
        jobId: job.id,
        message: 'Historical sync has been queued for background processing'
      });
    }
    
    // For regular syncs, continue with existing logic
    const idempotencyKey = {
      operation: 'xero_sync',
      syncType,
      modifiedSince: modifiedSince?.toISOString()
    };
    
    // Wrap the entire sync operation in a lock
    const result = await withLock(
      LOCK_RESOURCES.XERO_SYNC,
      600000, // 10 minutes in milliseconds
      async () => {
        return await withIdempotency(idempotencyKey, async () => {
          // Use transaction for entire sync operation
          return await memoryMonitor.monitorOperation('xero-sync-transaction', async () => {
            return await prisma.$transaction(async (tx) => {
            // Create sync log within transaction
            syncLog = await tx.syncLog.create({
              data: {
                syncType,
                status: 'in_progress',
                startedAt: new Date()
              }
            });
            
            // Log sync start
            await auditLogger.logSuccess(
              AuditAction.SYNC_START,
              AuditResource.SYNC_OPERATION,
              {
                resourceId: syncLog.id,
                metadata: {
                  syncType,
                  modifiedSince: modifiedSince?.toISOString()
                }
              }
            );
            
            // Initialize progress in Redis immediately after creating sync log
            await updateSyncProgress(syncLog.id, {
              syncId: syncLog.id,
              status: 'pending',
              percentage: 0,
              currentStep: 'Preparing sync...',
              steps: {},
              startedAt: syncLog.startedAt.toISOString()
            });

            return await performSync(tx, syncLog, {
              modifiedSince,
              entitiesToSync,
              fromDate,
              toDate,
              historicalSyncFromDate,
              isHistoricalSync,
              limits,
              accountIds: syncOptions.accountIds
            });
          }, {
            maxWait: 5000, // 5 seconds max wait
            timeout: 600000, // 10 minutes timeout for long sync operations
          });
          });
        });
      }
    );

    return NextResponse.json({
      ...result,
      syncId: result.syncId || syncLog?.id
    });
  } catch (error: any) {
    structuredLogger.error('Sync error', error, { component: 'xero-sync' });
    
    // Update sync log if it was created
    if (syncLog?.id) {
      try {
        // Handle error properly - might not be an Error object
        const errorMessage = error instanceof Error ? error.message : String(error) || 'An unknown error occurred during sync.';
        
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: errorMessage
          }
        });
      } catch (updateError) {
        // Log but don't fail if we can't update the sync log
        structuredLogger.error('Failed to update sync log', updateError, { 
          component: 'xero-sync',
          syncLogId: syncLog.id 
        });
      }
    }
    
    // Use proper error handling
    const { ApiErrorHandler } = await import('@/lib/api-error-handler');
    return ApiErrorHandler.handle(error, {
      endpoint: '/api/v1/xero/sync',
      operation: 'sync'
    });
  }
  }
  )
)

async function performSync(tx: any, syncLog: any, options: {
  modifiedSince?: Date;
  entitiesToSync: string[];
  fromDate?: Date;
  toDate?: Date;
  historicalSyncFromDate?: Date;
  isHistoricalSync?: boolean;
  limits: Record<string, number>;
  accountIds?: string[];
}) {
  let totalGLAccounts = 0;
  let totalAccounts = 0;
  let totalTransactions = 0;
  let totalContacts = 0;
  let totalInvoices = 0;
  let totalBills = 0;
  
  const { modifiedSince, entitiesToSync, fromDate, toDate, historicalSyncFromDate, isHistoricalSync, limits } = options;
  
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      throw new Error('Not connected to Xero');
    }
    
    await xero.updateTenants();
    
    if (!xero.tenants || xero.tenants.length === 0) {
      throw new Error('No Xero tenants found. Please reconnect to Xero.');
    }
    
    const tenant = xero.tenants[0];
    
    structuredLogger.info(`Starting ${syncLog.syncType} sync`, { 
      component: 'xero-sync',
      tenantName: tenant.tenantName,
      tenantId: tenant.tenantId,
      syncType: syncLog.syncType,
      modifiedSince: modifiedSince?.toISOString(),
      historicalSyncFromDate: historicalSyncFromDate?.toISOString(),
      isHistoricalSync,
      entitiesToSync,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
      limits
    });
    
    // Initialize progress
    await updateSyncProgress(syncLog.id, {
      status: 'in_progress',
      syncId: syncLog.id,
      startedAt: syncLog.startedAt,
      steps: {
        accounts: { status: 'pending', count: 0 },
        transactions: { status: 'pending', count: 0 },
        invoices: { status: 'pending', count: 0 },
        bills: { status: 'pending', count: 0 },
        contacts: { status: 'pending', count: 0 }
      },
      currentStep: 'Initializing sync...',
      percentage: 0
    });
    
    let createdTransactions = 0;
    let updatedTransactions = 0;
    
    // Step 1: Sync all GL accounts (Chart of Accounts) first
    if (entitiesToSync.includes('accounts')) {
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Syncing Chart of Accounts...',
        percentage: 5,
        steps: {
          accounts: { status: 'in_progress', count: 0 }
        }
      });
      
      structuredLogger.debug('Fetching GL accounts', { component: 'xero-sync' });
      const glAccountsResponse = await xero.accountingApi.getAccounts(
        tenant.tenantId,
        undefined,
        undefined,
        'Code ASC'
      );
      
      const glAccounts = glAccountsResponse.body.accounts || [];
      structuredLogger.info('GL accounts retrieved', { 
        component: 'xero-sync',
        count: glAccounts.length 
      });
      
      // Upsert GL accounts
      for (const account of glAccounts) {
        if (!account.accountID || !account.code) continue;
        
        await tx.gLAccount.upsert({
          where: { code: account.code },
          update: {
            name: account.name || '',
            type: account.type?.toString() || '',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims === true,
            enablePaymentsToAccount: account.enablePaymentsToAccount === true,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null,
            updatedAt: new Date()
          },
          create: {
            code: account.code,
            name: account.name || '',
            type: account.type?.toString() || '',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims === true,
            enablePaymentsToAccount: account.enablePaymentsToAccount === true,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null
          }
        });
        totalGLAccounts++;
      }
      
      structuredLogger.info('GL accounts synced', { 
        component: 'xero-sync',
        count: totalGLAccounts 
      });
      
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Chart of Accounts synced',
        percentage: 15,
        steps: {
          accounts: { status: 'completed', count: totalGLAccounts }
        }
      });
    }
    
    // Step 2: Sync all bank accounts with rate limiting (always needed for transactions)
    if (entitiesToSync.includes('accounts') || entitiesToSync.includes('transactions')) {
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Syncing bank accounts...',
        percentage: 20,
        steps: {
          accounts: { status: 'in_progress', count: totalGLAccounts }
        }
      });
      
      structuredLogger.debug('Fetching bank accounts', { component: 'xero-sync' });
      const accountsResponse = await executeXeroAPICall(
        xero,
        tenant.tenantId,
        async (client) => client.accountingApi.getAccounts(
          tenant.tenantId,
          undefined,
          'Type=="BANK"'
        )
      );
      
      const bankAccounts = accountsResponse.body.accounts || [];
      structuredLogger.info('Bank accounts retrieved', { 
        component: 'xero-sync',
        count: bankAccounts.length 
      });
      
      // Filter accounts if specific accountIds are provided
      const accountsToSync = options.accountIds 
        ? bankAccounts.filter(acc => acc.accountID && options.accountIds!.includes(acc.accountID))
        : bankAccounts;
      
      // Upsert bank accounts
      for (const account of accountsToSync) {
        if (!account.accountID) continue;
        
        await tx.bankAccount.upsert({
          where: { xeroAccountId: account.accountID },
          update: {
            name: account.name || '',
            code: account.code || null,
            currencyCode: account.currencyCode?.toString() || null,
            status: account.status?.toString() || null,
            bankName: account.bankAccountType?.toString() || null,
            accountNumber: account.bankAccountNumber || null,
            updatedAt: new Date()
          },
          create: {
            xeroAccountId: account.accountID,
            name: account.name || '',
            code: account.code || null,
            currencyCode: account.currencyCode?.toString() || null,
            status: account.status?.toString() || null,
            bankName: account.bankAccountType?.toString() || null,
            accountNumber: account.bankAccountNumber || null
          }
        });
        totalAccounts++;
      }
      
      structuredLogger.info('Bank accounts synced', {
        component: 'xero-sync',
        count: totalAccounts
      });
      
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Bank accounts synced',
        percentage: 25,
        steps: {
          accounts: { status: 'completed', count: totalGLAccounts + totalAccounts }
        }
      });
    
      // Step 3: Fetch transactions for EACH bank account
      if (entitiesToSync.includes('transactions')) {
        await updateSyncProgress(syncLog.id, {
          currentStep: 'Syncing transactions...',
          percentage: 30,
          steps: {
            transactions: { status: 'in_progress', count: 0 }
          }
        });
        
        const maxTransactions = limits.transactions || 10000;
        let transactionsSynced = 0;
        
        // Track sync checkpoints per account
        const accountCheckpoints: Record<string, boolean> = {};
        
        // Load existing checkpoints for resume capability
        const existingCheckpoints = await tx.syncCheckpoint.findMany({
          where: { syncLogId: syncLog.id }
        });
        
        for (const checkpoint of existingCheckpoints) {
          const data = JSON.parse(checkpoint.data);
          if (data.accountId) {
            accountCheckpoints[data.accountId] = true;
          }
        }
        
        for (let i = 0; i < accountsToSync.length; i++) {
          const account = accountsToSync[i];
          if (!account.accountID) continue;
          if (transactionsSynced >= maxTransactions) break;
          
          // Skip if already processed (checkpoint exists)
          if (accountCheckpoints[account.accountID]) {
            structuredLogger.info('Skipping already synced account', {
              component: 'xero-sync',
              accountName: account.name,
              accountId: account.accountID
            });
            continue;
          }
      
          structuredLogger.info('Fetching transactions for account', {
            component: 'xero-sync',
            accountName: account.name,
            currencyCode: account.currencyCode
          });
          
          const dbAccount = await tx.bankAccount.findUnique({
            where: { xeroAccountId: account.accountID }
          });
          
          if (!dbAccount) continue;
          
          let accountTransactions = 0;
          
          // For historical sync, we fetch ALL transactions and filter locally
          // For incremental sync, we use modifiedSince header
          const effectiveModifiedSince = isHistoricalSync ? undefined : modifiedSince;
          
          // Build where clause - ONLY for account filtering (Date filtering doesn't work in Xero API)
          const whereClause = `BankAccount.AccountID=Guid("${account.accountID}")`;
          
          // Determine the date range for local filtering
          const filterFromDate = historicalSyncFromDate || fromDate;
          const filterToDate = toDate;
          
          structuredLogger.info('Fetching transactions with date range', {
            component: 'xero-sync',
            accountName: account.name,
            isHistoricalSync,
            filterFromDate: filterFromDate?.toISOString(),
            filterToDate: filterToDate?.toISOString(),
            modifiedSince: effectiveModifiedSince?.toISOString()
          });
          
          // Use paginated API call generator with rate limiting
          const transactionPages = paginatedXeroAPICallGenerator(
            xero,
            tenant.tenantId,
            async (client, pageNum) => {
              structuredLogger.debug('Fetching transaction page', {
                component: 'xero-sync',
                accountName: account.name,
                pageNum
              });
              const response = await client.accountingApi.getBankTransactions(
                tenant.tenantId,
                effectiveModifiedSince, // If-Modified-Since for incremental sync (null for historical)
                whereClause, // Filter by account only
                undefined, // Order
                100, // Page size
                undefined, // unitdp
                pageNum // Page number
              );
              
              const transactions = response.body.bankTransactions || [];
              structuredLogger.debug('Transaction page fetched', {
                component: 'xero-sync',
                pageNum,
                transactionCount: transactions.length
              });
              
              return {
                items: transactions,
                hasMore: transactions.length === 100 && transactionsSynced + accountTransactions < maxTransactions
              };
            },
            { maxPages: 100, delayBetweenPages: 500 } // 500ms delay between pages
          );
      
          // Process transactions as they come in
          for await (const transactions of transactionPages) {
              // Process each transaction
              for (const xeroTx of transactions as any[]) {
                if (!xeroTx.bankTransactionID) continue;
                if (transactionsSynced >= maxTransactions) break;
                
                // Apply local date filtering
                const txDate = xeroTx.date ? new Date(xeroTx.date) : null;
                if (txDate) {
                  // Skip if before filterFromDate
                  if (filterFromDate && txDate < filterFromDate) {
                    structuredLogger.debug('Skipping transaction before start date', {
                      component: 'xero-sync',
                      transactionDate: txDate.toISOString(),
                      filterFromDate: filterFromDate.toISOString()
                    });
                    continue;
                  }
                  // Skip if after filterToDate
                  if (filterToDate && txDate > filterToDate) {
                    structuredLogger.debug('Skipping transaction after end date', {
                      component: 'xero-sync',
                      transactionDate: txDate.toISOString(),
                      filterToDate: filterToDate.toISOString()
                    });
                    continue;
                  }
                }
                
                // Prepare line items as JSON string
                const lineItemsJson = xeroTx.lineItems ? JSON.stringify(xeroTx.lineItems) : null;
                
                // Upsert transaction
                const existing = await tx.bankTransaction.findUnique({
                  where: { xeroTransactionId: xeroTx.bankTransactionID }
                });
                
                await tx.bankTransaction.upsert({
                  where: { xeroTransactionId: xeroTx.bankTransactionID },
                  update: {
                    bankAccountId: dbAccount.id,
                    date: new Date(xeroTx.date || new Date()),
                    amount: xeroTx.total || 0,
                    currencyCode: xeroTx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                    type: xeroTx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                    status: xeroTx.status?.toString() || 'AUTHORISED',
                    isReconciled: xeroTx.isReconciled || false,
                    reference: xeroTx.reference || null,
                    description: xeroTx.reference || xeroTx.lineItems?.[0]?.description || xeroTx.contact?.name || null,
                    contactName: xeroTx.contact?.name || null,
                    lineItems: lineItemsJson,
                    hasAttachments: xeroTx.hasAttachments || false,
                    lastSyncedAt: new Date()
                  },
                  create: {
                    xeroTransactionId: xeroTx.bankTransactionID,
                    bankAccountId: dbAccount.id,
                    date: new Date(xeroTx.date || new Date()),
                    amount: xeroTx.total || 0,
                    currencyCode: xeroTx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                    type: xeroTx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                    status: xeroTx.status?.toString() || 'AUTHORISED',
                    isReconciled: xeroTx.isReconciled || false,
                    reference: xeroTx.reference || null,
                    description: xeroTx.reference || xeroTx.lineItems?.[0]?.description || xeroTx.contact?.name || null,
                    contactName: xeroTx.contact?.name || null,
                    lineItems: lineItemsJson,
                    hasAttachments: xeroTx.hasAttachments || false
                  }
                });
                
                if (existing) {
                  updatedTransactions++;
                } else {
                  createdTransactions++;
                }
                
                accountTransactions++;
                totalTransactions++;
                transactionsSynced++;
                
                // Update progress every 100 transactions
                if (totalTransactions % 100 === 0) {
                  const progressPercentage = 30 + Math.min(35, (transactionsSynced / maxTransactions) * 35);
                  await updateSyncProgress(syncLog.id, {
                    currentStep: `Syncing transactions: ${totalTransactions} processed...`,
                    percentage: progressPercentage,
                    steps: {
                      transactions: { status: 'in_progress', count: totalTransactions }
                    }
                  });
                }
              }
              if (transactionsSynced >= maxTransactions) break;
          }
          
          structuredLogger.debug('Account sync complete', { 
            component: 'xero-sync',
            accountName: account.name,
            transactionCount: accountTransactions 
          });
          
          // Save checkpoint for this account
          accountCheckpoints[account.accountID] = true;
          
          // Update progress with account-specific info
          const progressPercentage = 30 + Math.min(35, ((i + 1) / accountsToSync.length) * 35);
          await updateSyncProgress(syncLog.id, {
            currentStep: `Synced ${i + 1}/${accountsToSync.length} accounts (${totalTransactions} transactions)`,
            percentage: progressPercentage,
            steps: {
              transactions: { 
                status: 'in_progress', 
                count: totalTransactions,
                details: `Processed ${i + 1}/${accountsToSync.length} accounts`
              }
            }
          });
          
          // Save checkpoint to database for recovery
          await tx.syncCheckpoint.upsert({
            where: {
              syncLogId_checkpointKey: {
                syncLogId: syncLog.id,
                checkpointKey: `account_${account.accountID}`
              }
            },
            update: {
              data: JSON.stringify({
                accountId: account.accountID,
                accountName: account.name,
                transactionCount: accountTransactions,
                completedAt: new Date()
              }),
              updatedAt: new Date()
            },
            create: {
              syncLogId: syncLog.id,
              checkpointKey: `account_${account.accountID}`,
              data: JSON.stringify({
                accountId: account.accountID,
                accountName: account.name,
                transactionCount: accountTransactions,
                completedAt: new Date()
              })
            }
          });
        }
        
        await updateSyncProgress(syncLog.id, {
          currentStep: 'Transactions synced',
          percentage: 65,
          steps: {
            transactions: { status: 'completed', count: totalTransactions }
          }
        });
      }
    } else {
      // If not syncing accounts/transactions, ensure bankAccounts is still defined
      var bankAccounts: any[] = [];
    }
    
    // Step 4: Sync invoices if requested
    if (entitiesToSync.includes('invoices') || entitiesToSync.includes('bills')) {
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Syncing invoices and bills...',
        percentage: 70,
        steps: {
          invoices: { status: 'in_progress', count: 0 },
          bills: { status: 'in_progress', count: 0 }
        }
      });
      
      structuredLogger.debug('Fetching open invoices', { component: 'xero-sync' });
      
      try {
        // Fetch customer invoices (ACCREC) if requested
        if (entitiesToSync.includes('invoices')) {
          const maxInvoices = limits.invoices || 5000;
          // Only filter by status and type - date filtering will be done locally
          const invoiceWhereClause = 'Status=="AUTHORISED"&&Type=="ACCREC"';
          
          // Use historical sync settings if applicable
          const invoiceModifiedSince = isHistoricalSync ? undefined : modifiedSince;
          const invoiceFilterFromDate = historicalSyncFromDate || fromDate;
          const invoiceFilterToDate = toDate;
          
          const customerInvoicesResponse = await executeXeroAPICall(
            xero,
            tenant.tenantId,
            async (client) => client.accountingApi.getInvoices(
              tenant.tenantId,
              invoiceModifiedSince, // If-Modified-Since for incremental sync
              invoiceWhereClause,
              undefined,
              undefined,
              undefined,
              undefined,
              ['AUTHORISED'],
              Math.min(100, maxInvoices)
            )
          );
      
          const customerInvoices = customerInvoicesResponse.body.invoices || [];
          structuredLogger.info('Customer invoices retrieved', { 
            component: 'xero-sync',
            count: customerInvoices.length 
          });
          
          // Upsert customer invoices
          let invoicesSynced = 0;
          for (const invoice of customerInvoices) {
            if (!invoice.invoiceID || invoice.amountDue === 0) continue;
            if (invoicesSynced >= maxInvoices) break;
            
            // Apply local date filtering
            const invoiceDate = invoice.date ? new Date(invoice.date) : null;
            if (invoiceDate) {
              if (invoiceFilterFromDate && invoiceDate < invoiceFilterFromDate) continue;
              if (invoiceFilterToDate && invoiceDate > invoiceFilterToDate) continue;
            }
            
            await tx.syncedInvoice.upsert({
              where: { id: invoice.invoiceID },
              update: {
                contactId: invoice.contact?.contactID || '',
                contactName: invoice.contact?.name || null,
                invoiceNumber: invoice.invoiceNumber || null,
                reference: invoice.reference || null,
                dueDate: new Date(invoice.dueDate || new Date()),
                date: new Date(invoice.date || new Date()),
                amountDue: invoice.amountDue || 0,
                total: invoice.total || 0,
                type: 'ACCREC',
                status: (invoice.amountDue || 0) > 0 ? 'OPEN' : 'PAID',
                lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
                currencyCode: invoice.currencyCode?.toString() || null,
                lastModifiedUtc: new Date(),
                updatedAt: new Date()
              },
              create: {
                id: invoice.invoiceID,
                contactId: invoice.contact?.contactID || '',
                contactName: invoice.contact?.name || null,
                invoiceNumber: invoice.invoiceNumber || null,
                reference: invoice.reference || null,
                dueDate: new Date(invoice.dueDate || new Date()),
                date: new Date(invoice.date || new Date()),
                amountDue: invoice.amountDue || 0,
                total: invoice.total || 0,
                type: 'ACCREC',
                status: (invoice.amountDue || 0) > 0 ? 'OPEN' : 'PAID',
                lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
                currencyCode: invoice.currencyCode?.toString() || null,
                lastModifiedUtc: new Date()
              }
            });
            totalInvoices++;
            invoicesSynced++;
          }
          
          await updateSyncProgress(syncLog.id, {
            steps: {
              invoices: { status: 'completed', count: totalInvoices }
            }
          });
        }
        
        // Fetch supplier bills (ACCPAY) if requested
        if (entitiesToSync.includes('bills')) {
          const maxBills = limits.bills || 5000;
          // Only filter by status and type - date filtering will be done locally
          const billsWhereClause = 'Status=="AUTHORISED"&&Type=="ACCPAY"';
          
          // Use same date filtering as invoices
          const billsModifiedSince = isHistoricalSync ? undefined : modifiedSince;
          const billsFilterFromDate = historicalSyncFromDate || fromDate;
          const billsFilterToDate = toDate;
          
          const supplierBillsResponse = await executeXeroAPICall(
            xero,
            tenant.tenantId,
            async (client) => client.accountingApi.getInvoices(
              tenant.tenantId,
              billsModifiedSince, // If-Modified-Since for incremental sync
              billsWhereClause,
              undefined,
              undefined,
              undefined,
              undefined,
              ['AUTHORISED'],
              Math.min(100, maxBills)
            )
          );
      
          const supplierBills = supplierBillsResponse.body.invoices || [];
          structuredLogger.info('Supplier bills retrieved', { 
            component: 'xero-sync',
            count: supplierBills.length 
          });
          
          // Upsert supplier bills
          let billsSynced = 0;
          for (const bill of supplierBills) {
            if (!bill.invoiceID || bill.amountDue === 0) continue;
            if (billsSynced >= maxBills) break;
            
            // Apply local date filtering
            const billDate = bill.date ? new Date(bill.date) : null;
            if (billDate) {
              if (billsFilterFromDate && billDate < billsFilterFromDate) continue;
              if (billsFilterToDate && billDate > billsFilterToDate) continue;
            }
            
            await tx.syncedInvoice.upsert({
              where: { id: bill.invoiceID },
              update: {
                contactId: bill.contact?.contactID || '',
                contactName: bill.contact?.name || null,
                invoiceNumber: bill.invoiceNumber || null,
                reference: bill.reference || null,
                dueDate: new Date(bill.dueDate || new Date()),
                date: new Date(bill.date || new Date()),
                amountDue: bill.amountDue || 0,
                total: bill.total || 0,
                type: 'ACCPAY',
                status: (bill.amountDue || 0) > 0 ? 'OPEN' : 'PAID',
                lineAmountTypes: bill.lineAmountTypes?.toString() || null,
                currencyCode: bill.currencyCode?.toString() || null,
                lastModifiedUtc: new Date(),
                updatedAt: new Date()
              },
              create: {
                id: bill.invoiceID,
                contactId: bill.contact?.contactID || '',
                contactName: bill.contact?.name || null,
                invoiceNumber: bill.invoiceNumber || null,
                reference: bill.reference || null,
                dueDate: new Date(bill.dueDate || new Date()),
                date: new Date(bill.date || new Date()),
                amountDue: bill.amountDue || 0,
                total: bill.total || 0,
                type: 'ACCPAY',
                status: (bill.amountDue || 0) > 0 ? 'OPEN' : 'PAID',
                lineAmountTypes: bill.lineAmountTypes?.toString() || null,
                currencyCode: bill.currencyCode?.toString() || null,
                lastModifiedUtc: new Date()
              }
            });
            totalBills++;
            billsSynced++;
          }
          
          await updateSyncProgress(syncLog.id, {
            steps: {
              bills: { status: 'completed', count: totalBills }
            }
          });
        }
      } catch (invoiceError) {
        structuredLogger.error('Error syncing invoices', invoiceError, { component: 'xero-sync' });
      }
      
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Invoices and bills synced',
        percentage: 85
      });
    }

    // Step 5: Sync currency rates for all active currencies
    try {
      await updateSyncProgress(syncLog.id, {
        currentStep: 'Syncing currency rates...',
        percentage: 90
      });
      
      structuredLogger.info('Syncing currency rates', { component: 'xero-sync' });
      
      // Collect all unique currencies from bank accounts and transactions
      const currencies = new Set<string>();
      
      // Get currencies from bank accounts that were synced
      if (entitiesToSync.includes('accounts') || entitiesToSync.includes('transactions')) {
        const syncedAccounts = await tx.bankAccount.findMany({
          select: { currencyCode: true },
          where: { currencyCode: { not: null } },
          distinct: ['currencyCode']
        });
        
        for (const account of syncedAccounts) {
          if (account.currencyCode) {
            currencies.add(account.currencyCode);
          }
        }
      }
      
      // Add currencies from invoices
      if (entitiesToSync.includes('invoices') || entitiesToSync.includes('bills')) {
        const allInvoices = await tx.syncedInvoice.findMany({
          select: { currencyCode: true },
          where: { currencyCode: { not: null } },
          distinct: ['currencyCode']
        });
        
        for (const invoice of allInvoices) {
          if (invoice.currencyCode) {
            currencies.add(invoice.currencyCode);
          }
        }
      }
      
      // Sync rates for all currencies
      if (currencies.size > 0) {
        await CurrencyService.syncCurrencyRates(Array.from(currencies), tx);
      }
      
      structuredLogger.info('Currency rates synced', { 
        component: 'xero-sync',
        currencies: Array.from(currencies)
      });
    } catch (currencyError) {
      structuredLogger.error('Error syncing currency rates', currencyError, { 
        component: 'xero-sync' 
      });
      // Don't fail the entire sync for currency errors
    }

    // Final progress update using helper
    await completeSyncProgress(syncLog.id, {
      glAccounts: totalGLAccounts,
      bankAccounts: totalAccounts,
      transactions: totalTransactions,
      invoices: totalInvoices,
      bills: totalBills,
      contacts: totalContacts,
      created: createdTransactions,
      updated: updatedTransactions
    });

    structuredLogger.info('Sync completed successfully', {
      component: 'xero-sync',
      syncType: syncLog.syncType,
      glAccounts: totalGLAccounts,
      bankAccounts: totalAccounts,
      totalTransactions,
      customerInvoices: totalInvoices,
      supplierBills: totalBills,
      contacts: totalContacts,
      created: createdTransactions,
      updated: updatedTransactions,
      entitiesToSync,
      dateRange: {
        from: (historicalSyncFromDate || fromDate)?.toISOString(),
        to: toDate?.toISOString()
      },
      isHistoricalSync,
      historicalSyncFromDate: historicalSyncFromDate?.toISOString()
    });
    
    // Update sync log to success status
    await tx.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated: createdTransactions + totalInvoices + totalBills,
        recordsUpdated: updatedTransactions,
        details: JSON.stringify({
          glAccounts: totalGLAccounts,
          bankAccounts: totalAccounts,
          transactions: totalTransactions,
          invoices: totalInvoices,
          bills: totalBills,
          contacts: totalContacts,
          entitiesToSync,
          dateRange: {
            from: fromDate?.toISOString(),
            to: toDate?.toISOString()
          },
          limits
        }),
        errorMessage: null
      }
    });
    
    // Log sync success
    await auditLogger.logSuccess(
      AuditAction.SYNC_COMPLETE,
      AuditResource.SYNC_OPERATION,
      {
        resourceId: syncLog.id,
        metadata: {
          syncType: syncLog.syncType,
          summary: {
            glAccounts: totalGLAccounts,
            bankAccounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices,
            bills: totalBills,
            contacts: totalContacts,
            created: createdTransactions,
            updated: updatedTransactions
          },
          options: {
            entitiesToSync,
            dateRange: {
              from: fromDate?.toISOString(),
              to: toDate?.toISOString()
            },
            limits
          }
        },
        duration: Date.now() - syncLog.startedAt.getTime()
      }
    );
    
    return {
      success: true,
      syncId: syncLog.id,
      summary: {
        glAccounts: totalGLAccounts,
        bankAccounts: totalAccounts,
        transactions: totalTransactions,
        invoices: totalInvoices,
        bills: totalBills,
        contacts: totalContacts,
        created: createdTransactions,
        updated: updatedTransactions
      },
      options: {
        entitiesToSync,
        dateRange: {
          from: fromDate?.toISOString(),
          to: toDate?.toISOString()
        },
        limits
      }
    };
    
  } catch (error: any) {
    structuredLogger.error('Sync error', error, { component: 'xero-sync' });
    
    // Update progress to failed using helper
    await failSyncProgress(syncLog.id, error.message || 'An unknown error occurred during sync');
    
    // Log sync failure
    await auditLogger.logFailure(
      AuditAction.SYNC_FAILED,
      AuditResource.SYNC_OPERATION,
      error,
      {
        resourceId: syncLog.id,
        metadata: {
          syncType: syncLog.syncType,
          partialData: {
            glAccounts: totalGLAccounts,
            bankAccounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices,
            bills: totalBills,
            contacts: totalContacts
          },
          options: {
            entitiesToSync,
            dateRange: {
              from: fromDate?.toISOString(),
              to: toDate?.toISOString()
            },
            limits
          }
        },
        duration: Date.now() - syncLog.startedAt.getTime()
      }
    );
    
    await tx.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error) || 'An unknown error occurred',
        details: JSON.stringify({
          partialData: {
            glAccounts: totalGLAccounts,
            bankAccounts: totalAccounts,
            transactions: totalTransactions,
            invoices: totalInvoices,
            bills: totalBills,
            contacts: totalContacts
          },
          options: {
            entitiesToSync,
            dateRange: {
              from: fromDate?.toISOString(),
              to: toDate?.toISOString()
            },
            limits
          }
        })
      }
    });
    
    throw error; // Re-throw to trigger transaction rollback
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const lastSync = await prisma.syncLog.findFirst({
      where: { syncType: 'full_sync' },
      orderBy: { startedAt: 'desc' }
    });
    
    const stats = await prisma.bankTransaction.aggregate({
      _count: true,
      _sum: { amount: true }
    });
    
    const accountStats = await prisma.bankAccount.count();
    
    const unreconciledCount = await prisma.bankTransaction.count({
      where: { 
        isReconciled: false,
        status: { not: 'DELETED' }
      }
    });
    
    return NextResponse.json({
      lastSync,
      stats: {
        totalAccounts: accountStats,
        totalTransactions: stats._count,
        totalAmount: stats._sum.amount,
        unreconciledCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error.message
    }, { status: 500 });
  }
}
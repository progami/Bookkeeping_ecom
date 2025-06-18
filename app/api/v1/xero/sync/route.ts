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
import { updateSyncProgress } from '@/lib/sync-progress-manager';

export const POST = withRateLimit(
  withAuthValidation(
    { bodySchema: xeroSyncSchema, authLevel: ValidationLevel.XERO },
    async (request, { body, session }) => {
    let syncLog: any;

    try {
      const forceFullSync = body?.forceSync || false;
      const syncOptions = body?.syncOptions || {};
      
      // Default to all entities if not specified
      const entitiesToSync = syncOptions.entities || ['accounts', 'transactions', 'invoices', 'bills', 'contacts'];
      const fromDate = syncOptions.fromDate ? new Date(syncOptions.fromDate) : undefined;
      const toDate = syncOptions.toDate ? new Date(syncOptions.toDate) : undefined;
      const limits = syncOptions.limits || {};
    
    // Get last successful sync for incremental sync
    const lastSuccessfulSync = await prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { completedAt: 'desc' }
    });
    
    const syncType = forceFullSync || !lastSuccessfulSync ? 'full_sync' : 'incremental_sync';
    const modifiedSince = !forceFullSync && lastSuccessfulSync?.completedAt || fromDate || undefined;
    
    // Use idempotency for sync operations
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

            return await performSync(tx, syncLog, {
              modifiedSince,
              entitiesToSync,
              fromDate,
              toDate,
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

    return NextResponse.json(result);
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
  limits: Record<string, number>;
  accountIds?: string[];
}) {
  let totalGLAccounts = 0;
  let totalAccounts = 0;
  let totalTransactions = 0;
  let totalContacts = 0;
  let totalInvoices = 0;
  let totalBills = 0;
  
  const { modifiedSince, entitiesToSync, fromDate, toDate, limits } = options;
  
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
    
    structuredLogger.info(`Starting ${modifiedSince ? 'incremental' : 'full'} sync`, { 
      component: 'xero-sync',
      tenantName: tenant.tenantName,
      tenantId: tenant.tenantId,
      modifiedSince: modifiedSince?.toISOString(),
      entitiesToSync,
      fromDate: fromDate?.toISOString(),
      toDate: toDate?.toISOString(),
      limits
    });
    
    // Initialize progress
    updateSyncProgress(syncLog.id, {
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
      updateSyncProgress(syncLog.id, {
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
      
      updateSyncProgress(syncLog.id, {
        currentStep: 'Chart of Accounts synced',
        percentage: 15,
        steps: {
          accounts: { status: 'completed', count: totalGLAccounts }
        }
      });
    }
    
    // Step 2: Sync all bank accounts with rate limiting (always needed for transactions)
    if (entitiesToSync.includes('accounts') || entitiesToSync.includes('transactions')) {
      updateSyncProgress(syncLog.id, {
        currentStep: 'Syncing bank accounts...',
        percentage: 20,
        steps: {
          accounts: { status: 'in_progress', count: totalGLAccounts }
        }
      });
      
      structuredLogger.debug('Fetching bank accounts', { component: 'xero-sync' });
      const accountsResponse = await executeXeroAPICall(
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
      
      updateSyncProgress(syncLog.id, {
        currentStep: 'Bank accounts synced',
        percentage: 25,
        steps: {
          accounts: { status: 'completed', count: totalGLAccounts + totalAccounts }
        }
      });
    
      // Step 3: Fetch transactions for EACH bank account
      if (entitiesToSync.includes('transactions')) {
        updateSyncProgress(syncLog.id, {
          currentStep: 'Syncing transactions...',
          percentage: 30,
          steps: {
            transactions: { status: 'in_progress', count: 0 }
          }
        });
        
        const maxTransactions = limits.transactions || 10000;
        let transactionsSynced = 0;
        
        for (const account of accountsToSync) {
          if (!account.accountID) continue;
          if (transactionsSynced >= maxTransactions) break;
      
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
          
          // Build where clause for date filtering
          let whereClause = `BankAccount.AccountID=Guid("${account.accountID}")`;
          if (fromDate) {
            whereClause += ` AND Date >= DateTime(${fromDate.toISOString().split('T')[0]})`;
          }
          if (toDate) {
            whereClause += ` AND Date <= DateTime(${toDate.toISOString().split('T')[0]})`;
          }
          
          // Use paginated API call generator with rate limiting
          const transactionPages = paginatedXeroAPICallGenerator(
            tenant.tenantId,
            async (client, pageNum) => {
              structuredLogger.debug('Fetching transaction page', {
                component: 'xero-sync',
                accountName: account.name,
                pageNum
              });
              const response = await client.accountingApi.getBankTransactions(
                tenant.tenantId,
                modifiedSince, // If-Modified-Since for incremental sync
                whereClause, // Filter by account and dates
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
              for (const xeroTx of transactions) {
                if (!xeroTx.bankTransactionID) continue;
                if (transactionsSynced >= maxTransactions) break;
                
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
                  updateSyncProgress(syncLog.id, {
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
        }
        
        updateSyncProgress(syncLog.id, {
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
      updateSyncProgress(syncLog.id, {
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
          let invoiceWhereClause = 'Status=="AUTHORISED"&&Type=="ACCREC"';
          
          // Add date filtering if provided
          if (fromDate) {
            invoiceWhereClause += `&&Date >= DateTime(${fromDate.toISOString().split('T')[0]})`;
          }
          if (toDate) {
            invoiceWhereClause += `&&Date <= DateTime(${toDate.toISOString().split('T')[0]})`;
          }
          
          const customerInvoicesResponse = await executeXeroAPICall(
            tenant.tenantId,
            async (client) => client.accountingApi.getInvoices(
              tenant.tenantId,
              modifiedSince, // If-Modified-Since for incremental sync
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
          
          updateSyncProgress(syncLog.id, {
            steps: {
              invoices: { status: 'completed', count: totalInvoices }
            }
          });
        }
        
        // Fetch supplier bills (ACCPAY) if requested
        if (entitiesToSync.includes('bills')) {
          const maxBills = limits.bills || 5000;
          let billsWhereClause = 'Status=="AUTHORISED"&&Type=="ACCPAY"';
          
          // Add date filtering if provided
          if (fromDate) {
            billsWhereClause += `&&Date >= DateTime(${fromDate.toISOString().split('T')[0]})`;
          }
          if (toDate) {
            billsWhereClause += `&&Date <= DateTime(${toDate.toISOString().split('T')[0]})`;
          }
          
          const supplierBillsResponse = await executeXeroAPICall(
            tenant.tenantId,
            async (client) => client.accountingApi.getInvoices(
              tenant.tenantId,
              modifiedSince, // If-Modified-Since for incremental sync
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
          
          updateSyncProgress(syncLog.id, {
            steps: {
              bills: { status: 'completed', count: totalBills }
            }
          });
        }
      } catch (invoiceError) {
        structuredLogger.error('Error syncing invoices', invoiceError, { component: 'xero-sync' });
      }
      
      updateSyncProgress(syncLog.id, {
        currentStep: 'Invoices and bills synced',
        percentage: 85
      });
    }

    // Step 5: Sync currency rates for all active currencies
    try {
      updateSyncProgress(syncLog.id, {
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
        await CurrencyService.syncCurrencyRates(Array.from(currencies));
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

    // Final progress update
    updateSyncProgress(syncLog.id, {
      currentStep: 'Sync completed successfully',
      percentage: 100,
      steps: {
        accounts: { status: 'completed', count: totalGLAccounts + totalAccounts },
        transactions: { status: 'completed', count: totalTransactions },
        invoices: { status: 'completed', count: totalInvoices },
        bills: { status: 'completed', count: totalBills },
        contacts: { status: totalContacts > 0 ? 'completed' : 'skipped', count: totalContacts }
      }
    });

    structuredLogger.info('Sync completed successfully', {
      component: 'xero-sync',
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
        from: fromDate?.toISOString(),
        to: toDate?.toISOString()
      }
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
    
    // Update progress to failed
    updateSyncProgress(syncLog.id, {
      currentStep: `Sync failed: ${error.message}`,
      percentage: 0,
      status: 'failed',
      errorMessage: error.message
    });
    
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
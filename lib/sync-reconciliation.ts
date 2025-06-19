import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';
import { executeXeroAPICall, paginatedXeroAPICall } from '@/lib/xero-api-helpers';

/**
 * Reconciliation sync to handle deleted/voided records
 * This ensures our local database stays in sync with Xero's state
 */
export async function performReconciliationSync(
  userId: string,
  options?: {
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const startTime = Date.now();
  structuredLogger.info('[Reconciliation Sync] Starting reconciliation sync', { userId, options });

  try {
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      throw new Error('Failed to get Xero client');
    }
    const { client: xeroClient, tenantId: xeroTenantId } = xeroData;

    // Track reconciliation results
    const results = {
      invoices: {
        total: 0,
        active: 0,
        voided: 0,
        deleted: 0,
        updated: 0
      },
      bills: {
        total: 0,
        active: 0,
        voided: 0,
        deleted: 0,
        updated: 0
      },
      transactions: {
        total: 0,
        active: 0,
        deleted: 0,
        updated: 0
      }
    };

    // 1. Reconcile Invoices (ACCREC)
    structuredLogger.info('[Reconciliation Sync] Reconciling sales invoices...');
    
    // Fetch ALL invoice IDs and statuses from Xero (not just AUTHORISED)
    const xeroInvoices = await paginatedXeroAPICall(
      xeroClient,
      xeroTenantId,
      async (client, page) => {
        return await client.accountingApi.getInvoices(
          xeroTenantId,
          options?.fromDate,
          undefined, // No where clause - we want ALL statuses
          'UpdatedDateUTC ASC',
          undefined,
          undefined,
          undefined,
          undefined,
          page
        );
      },
      'invoices'
    );

    // Create a map of Xero invoice IDs to their current status
    const xeroInvoiceMap = new Map<string, string>();
    for (const invoice of xeroInvoices) {
      if (invoice.type === 'ACCREC' && invoice.invoiceID) {
        xeroInvoiceMap.set(invoice.invoiceID, invoice.status?.toString() || 'DRAFT');
        results.invoices.total++;
        
        if (invoice.status === 'VOIDED') {
          results.invoices.voided++;
        } else if (invoice.status === 'DELETED') {
          results.invoices.deleted++;
        } else {
          results.invoices.active++;
        }
      }
    }

    // Get all local invoices for the same period
    const localInvoices = await prisma.syncedInvoice.findMany({
      where: {
        type: 'ACCREC',
        ...(options?.fromDate && {
          date: {
            gte: options.fromDate
          }
        })
      },
      select: {
        id: true,
        status: true
      }
    });

    // Check each local invoice against Xero
    for (const localInvoice of localInvoices) {
      const xeroStatus = xeroInvoiceMap.get(localInvoice.id);
      
      if (!xeroStatus) {
        // Invoice exists locally but not in Xero - mark as DELETED
        await prisma.syncedInvoice.update({
          where: { id: localInvoice.id },
          data: {
            status: 'DELETED',
            updatedAt: new Date()
          }
        });
        results.invoices.updated++;
        structuredLogger.info('[Reconciliation Sync] Marked invoice as deleted', { 
          invoiceId: localInvoice.id 
        });
      } else if (xeroStatus !== localInvoice.status) {
        // Status has changed - update it
        await prisma.syncedInvoice.update({
          where: { id: localInvoice.id },
          data: {
            status: xeroStatus,
            updatedAt: new Date()
          }
        });
        results.invoices.updated++;
        structuredLogger.info('[Reconciliation Sync] Updated invoice status', { 
          invoiceId: localInvoice.id,
          oldStatus: localInvoice.status,
          newStatus: xeroStatus
        });
      }
    }

    // 2. Reconcile Bills (ACCPAY)
    structuredLogger.info('[Reconciliation Sync] Reconciling bills...');
    
    // Reuse the same invoices response but filter for ACCPAY
    const xeroBillMap = new Map<string, string>();
    for (const bill of xeroInvoices) {
      if (bill.type === 'ACCPAY' && bill.invoiceID) {
        xeroBillMap.set(bill.invoiceID, bill.status?.toString() || 'DRAFT');
        results.bills.total++;
        
        if (bill.status === 'VOIDED') {
          results.bills.voided++;
        } else if (bill.status === 'DELETED') {
          results.bills.deleted++;
        } else {
          results.bills.active++;
        }
      }
    }

    // Get all local bills
    const localBills = await prisma.syncedInvoice.findMany({
      where: {
        type: 'ACCPAY',
        ...(options?.fromDate && {
          date: {
            gte: options.fromDate
          }
        })
      },
      select: {
        id: true,
        status: true
      }
    });

    // Check each local bill against Xero
    for (const localBill of localBills) {
      const xeroStatus = xeroBillMap.get(localBill.id);
      
      if (!xeroStatus) {
        // Bill exists locally but not in Xero - mark as DELETED
        await prisma.syncedInvoice.update({
          where: { id: localBill.id },
          data: {
            status: 'DELETED',
            updatedAt: new Date()
          }
        });
        results.bills.updated++;
        structuredLogger.info('[Reconciliation Sync] Marked bill as deleted', { 
          billId: localBill.id 
        });
      } else if (xeroStatus !== localBill.status) {
        // Status has changed - update it
        await prisma.syncedInvoice.update({
          where: { id: localBill.id },
          data: {
            status: xeroStatus,
            updatedAt: new Date()
          }
        });
        results.bills.updated++;
        structuredLogger.info('[Reconciliation Sync] Updated bill status', { 
          billId: localBill.id,
          oldStatus: localBill.status,
          newStatus: xeroStatus
        });
      }
    }

    // 3. Reconcile Bank Transactions
    structuredLogger.info('[Reconciliation Sync] Reconciling bank transactions...');
    
    // For bank transactions, we need to check if they've been deleted
    // Xero doesn't return deleted bank transactions, so we need to infer this
    const xeroTransactions = await paginatedXeroAPICall(
      xeroClient,
      xeroTenantId,
      async (client, page) => {
        return await client.accountingApi.getBankTransactions(
          xeroTenantId,
          options?.fromDate,
          undefined,
          'Date ASC',
          undefined,
          page
        );
      },
      'bankTransactions'
    );

    // Create a set of active transaction IDs
    const activeTransactionIds = new Set<string>();
    for (const transaction of xeroTransactions) {
      if (transaction.bankTransactionID) {
        activeTransactionIds.add(transaction.bankTransactionID);
        results.transactions.total++;
        results.transactions.active++;
      }
    }

    // Get all local transactions
    const localTransactions = await prisma.bankTransaction.findMany({
      where: {
        ...(options?.fromDate && {
          date: {
            gte: options.fromDate
          }
        }),
        // Only check non-deleted transactions
        status: {
          not: 'DELETED'
        }
      },
      select: {
        xeroTransactionId: true
      }
    });

    // Mark transactions that no longer exist in Xero as deleted
    for (const localTransaction of localTransactions) {
      if (!activeTransactionIds.has(localTransaction.xeroTransactionId)) {
        await prisma.bankTransaction.update({
          where: { xeroTransactionId: localTransaction.xeroTransactionId },
          data: {
            status: 'DELETED',
            updatedAt: new Date()
          }
        });
        results.transactions.deleted++;
        results.transactions.updated++;
        structuredLogger.info('[Reconciliation Sync] Marked transaction as deleted', { 
          transactionId: localTransaction.xeroTransactionId 
        });
      }
    }

    const duration = Date.now() - startTime;
    structuredLogger.info('[Reconciliation Sync] Reconciliation complete', {
      duration,
      durationSeconds: Math.round(duration / 1000),
      results
    });

    return results;
  } catch (error) {
    structuredLogger.error('[Reconciliation Sync] Reconciliation failed', error);
    throw error;
  }
}

/**
 * Schedule periodic reconciliation syncs
 * This should be called by a cron job or scheduled task
 */
export async function scheduleReconciliationSync() {
  try {
    // Get all users with active Xero connections
    const usersWithXero = await prisma.user.findMany({
      where: {
        xeroTokenSet: {
          not: null
        }
      },
      select: {
        id: true
      }
    });

    structuredLogger.info('[Reconciliation Sync] Starting scheduled reconciliation', {
      userCount: usersWithXero.length
    });

    // Perform reconciliation for each user
    for (const user of usersWithXero) {
      try {
        await performReconciliationSync(user.id, {
          // Reconcile data from the last 30 days
          fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        });
      } catch (error) {
        structuredLogger.error('[Reconciliation Sync] Failed for user', error, {
          userId: user.id
        });
      }
    }
  } catch (error) {
    structuredLogger.error('[Reconciliation Sync] Scheduled reconciliation failed', error);
  }
}
import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { XeroSyncJob, createRedisConnection } from '../queue-config';
import { structuredLogger } from '@/lib/logger';
import { memoryMonitor } from '@/lib/memory-monitor';
import { Contact, Invoice, BankTransaction } from 'xero-node';

export function createXeroSyncWorker() {
  const worker = new Worker<XeroSyncJob>(
    'xero-sync',
    async (job: Job<XeroSyncJob>) => {
      return memoryMonitor.monitorOperation('xero-sync-job', async () => {
        const { userId, tenantId, syncType, options } = job.data;
        
        structuredLogger.info('Starting Xero sync job', {
          component: 'xero-sync-worker',
          jobId: job.id,
          userId,
          syncType
        });

        try {
          // Update job progress
          await job.updateProgress(10);

          // Get Xero client
          const xeroData = await getXeroClientWithTenant();
          if (!xeroData) {
            throw new Error('Failed to get Xero client');
          }

          const { client: xero, tenantId: xeroTenantId } = xeroData;

          // Create sync log
          const syncLog = await prisma.syncLog.create({
            data: {
              syncType,
              status: 'in_progress',
              startedAt: new Date(),
              details: JSON.stringify({ options })
            }
          });

          let result;
          switch (syncType) {
            case 'full':
              result = await performFullSync(xero, xeroTenantId, job);
              break;
            case 'transactions':
              result = await syncTransactions(xero, xeroTenantId, job, options);
              break;
            case 'invoices':
              result = await syncInvoices(xero, xeroTenantId, job, options);
              break;
            case 'contacts':
              result = await syncContacts(xero, xeroTenantId, job);
              break;
            case 'incremental':
              result = await performIncrementalSync(xero, xeroTenantId, job, options);
              break;
            default:
              throw new Error(`Unknown sync type: ${syncType}`);
          }

          // Update sync log
          await prisma.syncLog.update({
            where: { id: syncLog.id },
            data: {
              status: 'success',
              completedAt: new Date(),
              recordsCreated: result.created,
              recordsUpdated: result.updated,
              details: JSON.stringify({ ...result, options })
            }
          });

          await job.updateProgress(100);

          structuredLogger.info('Xero sync job completed', {
            component: 'xero-sync-worker',
            jobId: job.id,
            result
          });

          return result;
        } catch (error) {
          structuredLogger.error('Xero sync job failed', error, {
            component: 'xero-sync-worker',
            jobId: job.id,
            userId
          });

          throw error;
        }
      });
    },
    {
      connection: createRedisConnection(),
      concurrency: 2, // Process 2 sync jobs simultaneously
      limiter: {
        max: 10,
        duration: 60000 // 10 jobs per minute
      }
    }
  );

  worker.on('completed', (job) => {
    structuredLogger.info('Xero sync job completed', {
      component: 'xero-sync-worker',
      jobId: job.id,
      data: job.data
    });
  });

  worker.on('failed', (job, err) => {
    structuredLogger.error('Xero sync job failed', err, {
      component: 'xero-sync-worker',
      jobId: job?.id,
      data: job?.data
    });
  });

  return worker;
}

async function performFullSync(xero: any, tenantId: string, job: Job) {
  const results = {
    contacts: { created: 0, updated: 0 },
    invoices: { created: 0, updated: 0 },
    transactions: { created: 0, updated: 0 },
    total: { created: 0, updated: 0 }
  };

  // Sync contacts (30% progress)
  await job.updateProgress(20);
  const contactsResult = await syncContacts(xero, tenantId, job);
  results.contacts = contactsResult;
  results.total.created += contactsResult.created;
  results.total.updated += contactsResult.updated;

  // Sync invoices (60% progress)
  await job.updateProgress(50);
  const invoicesResult = await syncInvoices(xero, tenantId, job);
  results.invoices = invoicesResult;
  results.total.created += invoicesResult.created;
  results.total.updated += invoicesResult.updated;

  // Sync transactions (90% progress)
  await job.updateProgress(80);
  const transactionsResult = await syncTransactions(xero, tenantId, job);
  results.transactions = transactionsResult;
  results.total.created += transactionsResult.created;
  results.total.updated += transactionsResult.updated;

  return results;
}

async function performIncrementalSync(xero: any, tenantId: string, job: Job, options?: any) {
  // Get last sync timestamp
  const lastSync = await prisma.syncLog.findFirst({
    where: {
      syncType: { in: ['full', 'incremental'] },
      status: 'success'
    },
    orderBy: { completedAt: 'desc' }
  });

  const modifiedSince = lastSync?.completedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days default
  
  const results = {
    contacts: { created: 0, updated: 0 },
    invoices: { created: 0, updated: 0 },
    transactions: { created: 0, updated: 0 },
    total: { created: 0, updated: 0 }
  };

  // Sync only modified records
  const syncOptions = {
    ...options,
    modifiedAfter: modifiedSince
  };

  // Sync modified contacts
  await job.updateProgress(30);
  const contactsResult = await syncContacts(xero, tenantId, job, syncOptions);
  results.contacts = contactsResult;
  results.total.created += contactsResult.created;
  results.total.updated += contactsResult.updated;

  // Sync modified invoices
  await job.updateProgress(60);
  const invoicesResult = await syncInvoices(xero, tenantId, job, syncOptions);
  results.invoices = invoicesResult;
  results.total.created += invoicesResult.created;
  results.total.updated += invoicesResult.updated;

  // Sync modified transactions
  await job.updateProgress(90);
  const transactionsResult = await syncTransactions(xero, tenantId, job, syncOptions);
  results.transactions = transactionsResult;
  results.total.created += transactionsResult.created;
  results.total.updated += transactionsResult.updated;

  return results;
}

async function syncContacts(xero: any, tenantId: string, job: Job, options?: any) {
  let created = 0;
  let updated = 0;
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await xero.accountingApi.getContacts(
      tenantId,
      options?.modifiedAfter,
      undefined,
      undefined,
      page,
      pageSize
    );

    const contacts = response.body.contacts || [];
    if (contacts.length === 0) break;

    // Batch upsert contacts
    for (const contact of contacts) {
      const existing = await prisma.contact.findUnique({
        where: { xeroContactId: contact.contactID! }
      });

      const contactData = {
        xeroContactId: contact.contactID!,
        contactNumber: contact.contactNumber || null,
        accountNumber: contact.accountNumber || null,
        contactStatus: contact.contactStatus || null,
        name: contact.name || '',
        firstName: contact.firstName || null,
        lastName: contact.lastName || null,
        companyNumber: contact.companyNumber || null,
        emailAddress: contact.emailAddress || null,
        bankAccountDetails: contact.bankAccountDetails || null,
        taxNumber: contact.taxNumber || null,
        accountsReceivableTaxType: contact.accountsReceivableTaxType || null,
        accountsPayableTaxType: contact.accountsPayableTaxType || null,
        isSupplier: contact.isSupplier || false,
        isCustomer: contact.isCustomer || false,
        defaultCurrency: contact.defaultCurrency || null,
        updatedDateUTC: contact.updatedDateUTC || new Date(),
        lastSyncedAt: new Date()
      };

      if (existing) {
        await prisma.contact.update({
          where: { xeroContactId: contact.contactID! },
          data: contactData
        });
        updated++;
      } else {
        await prisma.contact.create({ data: contactData });
        created++;
      }
    }

    if (contacts.length < pageSize) break;
    page++;
  }

  return { created, updated };
}

async function syncInvoices(xero: any, tenantId: string, job: Job, options?: any) {
  let created = 0;
  let updated = 0;
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await xero.accountingApi.getInvoices(
      tenantId,
      options?.modifiedAfter,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      page,
      pageSize
    );

    const invoices = response.body.invoices || [];
    if (invoices.length === 0) break;

    for (const invoice of invoices) {
      const existing = await prisma.invoice.findUnique({
        where: { xeroInvoiceId: invoice.invoiceID! }
      });

      const invoiceData = {
        xeroInvoiceId: invoice.invoiceID!,
        type: invoice.type?.toString() || 'UNKNOWN',
        contactId: invoice.contact?.contactID || '',
        date: invoice.date ? new Date(invoice.date) : new Date(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : null,
        status: invoice.status?.toString() || 'DRAFT',
        lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
        invoiceNumber: invoice.invoiceNumber || null,
        reference: invoice.reference || null,
        brandingThemeId: invoice.brandingThemeID || null,
        url: invoice.url || null,
        currencyCode: invoice.currencyCode || null,
        currencyRate: invoice.currencyRate || null,
        subTotal: invoice.subTotal || 0,
        totalTax: invoice.totalTax || 0,
        total: invoice.total || 0,
        totalDiscount: invoice.totalDiscount || null,
        hasAttachments: invoice.hasAttachments || false,
        isDiscounted: invoice.isDiscounted || false,
        amountDue: invoice.amountDue || 0,
        amountPaid: invoice.amountPaid || 0,
        fullyPaidOnDate: invoice.fullyPaidOnDate ? new Date(invoice.fullyPaidOnDate) : null,
        amountCredited: invoice.amountCredited || 0,
        updatedDateUTC: invoice.updatedDateUTC || new Date(),
        lastSyncedAt: new Date()
      };

      if (existing) {
        await prisma.invoice.update({
          where: { xeroInvoiceId: invoice.invoiceID! },
          data: invoiceData
        });
        updated++;
      } else {
        await prisma.invoice.create({ data: invoiceData });
        created++;
      }
    }

    if (invoices.length < pageSize) break;
    page++;
  }

  return { created, updated };
}

async function syncTransactions(xero: any, tenantId: string, job: Job, options?: any) {
  let created = 0;
  let updated = 0;
  let page = 1;
  const pageSize = 100;

  while (true) {
    const response = await xero.accountingApi.getBankTransactions(
      tenantId,
      options?.modifiedAfter,
      undefined,
      undefined,
      undefined,
      page,
      pageSize
    );

    const transactions = response.body.bankTransactions || [];
    if (transactions.length === 0) break;

    for (const transaction of transactions) {
      const existing = await prisma.bankTransaction.findUnique({
        where: { bankTransactionId: transaction.bankTransactionID! }
      });

      const transactionData = {
        bankTransactionId: transaction.bankTransactionID!,
        type: transaction.type?.toString() || 'UNKNOWN',
        contactId: transaction.contact?.contactID || null,
        bankAccountId: transaction.bankAccount?.accountID || '',
        isReconciled: transaction.isReconciled || false,
        date: transaction.date ? new Date(transaction.date) : new Date(),
        reference: transaction.reference || null,
        currencyCode: transaction.currencyCode || null,
        currencyRate: transaction.currencyRate || null,
        url: transaction.url || null,
        status: transaction.status?.toString() || 'AUTHORISED',
        lineAmountTypes: transaction.lineAmountTypes?.toString() || null,
        subTotal: transaction.subTotal || 0,
        totalTax: transaction.totalTax || 0,
        total: transaction.total || 0,
        prepaymentId: transaction.prepaymentID || null,
        overpaymentId: transaction.overpaymentID || null,
        updatedDateUTC: transaction.updatedDateUTC || new Date(),
        hasAttachments: transaction.hasAttachments || false,
        statusAttributeString: transaction.statusAttributeString || null,
        lastSyncedAt: new Date()
      };

      if (existing) {
        await prisma.bankTransaction.update({
          where: { bankTransactionId: transaction.bankTransactionID! },
          data: transactionData
        });
        updated++;
      } else {
        await prisma.bankTransaction.create({ data: transactionData });
        created++;
      }
    }

    if (transactions.length < pageSize) break;
    page++;
  }

  return { created, updated };
}
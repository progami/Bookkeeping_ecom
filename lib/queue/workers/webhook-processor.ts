import { Worker, Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';
import { createRedisConnection, QUEUE_NAMES, WebhookProcessingJob } from '../queue-config';
import crypto from 'crypto';

/**
 * Webhook event processors
 */
const eventProcessors = {
  async INVOICE(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.syncedInvoice.deleteMany({
        where: { id: resourceId }
      });
      return;
    }

    // Fetch invoice from Xero
    const response = await client.accountingApi.getInvoice(tenantId, resourceId);
    const invoice = response.body.invoices?.[0];
    
    if (!invoice) return;

    // Upsert invoice
    await prisma.syncedInvoice.upsert({
      where: { id: resourceId },
      create: {
        id: invoice.invoiceID,
        invoiceNumber: invoice.invoiceNumber || null,
        type: invoice.type?.toString() || 'UNKNOWN',
        status: invoice.status?.toString() || 'UNKNOWN',
        contactId: invoice.contact?.contactID || '',
        contactName: invoice.contact?.name || null,
        total: invoice.total?.toNumber() || 0,
        amountDue: invoice.amountDue?.toNumber() || 0,
        date: invoice.date ? new Date(invoice.date) : new Date(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : new Date(),
        reference: invoice.reference || null,
        lineAmountTypes: invoice.lineAmountTypes?.toString() || null,
        currencyCode: invoice.currencyCode || null,
        lastModifiedUtc: invoice.updatedDateUTC ? new Date(invoice.updatedDateUTC) : new Date()
      },
      update: {
        status: invoice.status?.toString() || 'UNKNOWN',
        total: invoice.total?.toNumber() || 0,
        amountDue: invoice.amountDue?.toNumber() || 0,
        lastModifiedUtc: invoice.updatedDateUTC ? new Date(invoice.updatedDateUTC) : new Date()
      }
    });

    structuredLogger.info('Invoice webhook processed', {
      component: 'webhook-processor',
      invoiceId: resourceId,
      eventType,
      invoiceNumber: invoice.invoiceNumber
    });
  },

  async CONTACT(client: any, tenantId: string, resourceId: string, eventType: string) {
    // Skip contact events as we don't have a Contact model
    structuredLogger.info('Contact webhook skipped - no Contact model', {
      component: 'webhook-processor',
      contactId: resourceId,
      eventType
    });
  },

  async PAYMENT(client: any, tenantId: string, resourceId: string, eventType: string) {
    // Payments are typically part of invoices, so we'll fetch the related invoice
    try {
      const response = await client.accountingApi.getPayment(tenantId, resourceId);
      const payment = response.body.payments?.[0];
      
      if (payment?.invoice?.invoiceID) {
        // Trigger invoice update to reflect payment
        await eventProcessors.INVOICE(client, tenantId, payment.invoice.invoiceID, 'Update');
      }
    } catch (error) {
      structuredLogger.error('Failed to process payment webhook', error, {
        component: 'webhook-processor',
        paymentId: resourceId
      });
    }
  },

  async BANKTRANSACTION(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.bankTransaction.deleteMany({
        where: { xeroTransactionId: resourceId }
      });
      return;
    }

    // Fetch transaction from Xero
    const response = await client.accountingApi.getBankTransaction(tenantId, resourceId);
    const transaction = response.body.bankTransactions?.[0];
    
    if (!transaction) return;

    // Get bank account
    const bankAccount = await prisma.bankAccount.findFirst({
      where: { xeroAccountId: transaction.bankAccount?.accountID }
    });

    if (!bankAccount) {
      structuredLogger.warn('Bank account not found for transaction', {
        component: 'webhook-processor',
        transactionId: resourceId,
        accountId: transaction.bankAccount?.accountID
      });
      return;
    }

    // Upsert transaction
    await prisma.bankTransaction.upsert({
      where: { xeroTransactionId: resourceId },
      create: {
        xeroTransactionId: transaction.bankTransactionID,
        type: transaction.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
        bankAccount: { connect: { id: bankAccount.id } },
        lineItems: JSON.stringify(transaction.lineItems || []),
        isReconciled: transaction.isReconciled || false,
        date: transaction.date ? new Date(transaction.date) : new Date(),
        reference: transaction.reference || null,
        currencyCode: transaction.currencyCode || null,
        status: transaction.status?.toString() || 'UNKNOWN',
        amount: transaction.total?.toNumber() || 0,
        description: transaction.lineItems?.[0]?.description || null,
        contactName: transaction.contact?.name || null,
        hasAttachments: transaction.hasAttachments || false
      },
      update: {
        type: transaction.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
        lineItems: JSON.stringify(transaction.lineItems || []),
        isReconciled: transaction.isReconciled || false,
        reference: transaction.reference || null,
        status: transaction.status?.toString() || 'UNKNOWN',
        amount: transaction.total?.toNumber() || 0,
        description: transaction.lineItems?.[0]?.description || null,
        contactName: transaction.contact?.name || null,
        hasAttachments: transaction.hasAttachments || false,
        lastSyncedAt: new Date()
      }
    });

    structuredLogger.info('Bank transaction webhook processed', {
      component: 'webhook-processor',
      transactionId: resourceId,
      eventType,
      amount: transaction.total?.toNumber()
    });
  },

  async BANKACCOUNT(client: any, tenantId: string, resourceId: string, eventType: string) {
    if (eventType === 'Delete') {
      await prisma.bankAccount.deleteMany({
        where: { xeroAccountId: resourceId }
      });
      return;
    }

    // Fetch account from Xero
    const response = await client.accountingApi.getAccount(tenantId, resourceId);
    const account = response.body.accounts?.[0];
    
    if (!account || account.type !== 'BANK') return;

    // Upsert bank account
    await prisma.bankAccount.upsert({
      where: { xeroAccountId: account.accountID },
      create: {
        xeroAccountId: account.accountID,
        code: account.code || null,
        name: account.name || '',
        status: account.status?.toString() || 'ACTIVE',
        currencyCode: account.currencyCode || null,
        accountNumber: account.bankAccountNumber || null,
        bankName: account.bankAccountType || null
      },
      update: {
        name: account.name || '',
        code: account.code || null,
        status: account.status?.toString() || 'ACTIVE',
        currencyCode: account.currencyCode || null,
        accountNumber: account.bankAccountNumber || null,
        bankName: account.bankAccountType || null
      }
    });

    structuredLogger.info('Bank account webhook processed', {
      component: 'webhook-processor',
      accountId: resourceId,
      eventType,
      accountName: account.name
    });
  }
};

/**
 * Process a single webhook event
 */
async function processWebhookEvent(job: Job<WebhookProcessingJob>) {
  const { eventType, payload, retryCount = 0 } = job.data;
  
  const xeroData = await getXeroClientWithTenant();
  if (!xeroData) {
    throw new Error('No Xero client available for webhook processing');
  }

  const { client, tenantId } = xeroData;
  const { eventCategory, resourceId } = payload;
  
  // Check if we have a processor for this event category
  const processor = eventProcessors[eventCategory as keyof typeof eventProcessors];
  if (!processor) {
    structuredLogger.warn('No processor for webhook event category', {
      component: 'webhook-processor',
      eventCategory,
      eventType,
      resourceId
    });
    return;
  }

  // Process the event
  await processor(client, tenantId, resourceId, eventType);
  
  // Update job progress
  await job.updateProgress(100);
}

/**
 * Create and configure the webhook processing worker
 */
export function createWebhookProcessor() {
  const worker = new Worker<WebhookProcessingJob>(
    QUEUE_NAMES.WEBHOOK_PROCESSING,
    async (job) => {
      const startTime = Date.now();
      
      structuredLogger.info('Processing webhook job', {
        component: 'webhook-processor',
        jobId: job.id,
        eventType: job.data.eventType,
        attempt: job.attemptsMade + 1
      });

      try {
        await processWebhookEvent(job);
        
        const duration = Date.now() - startTime;
        structuredLogger.info('Webhook job completed', {
          component: 'webhook-processor',
          jobId: job.id,
          duration
        });
        
        return { success: true, duration };
      } catch (error) {
        const duration = Date.now() - startTime;
        structuredLogger.error('Webhook job failed', error as Error, {
          component: 'webhook-processor',
          jobId: job.id,
          duration,
          attempt: job.attemptsMade + 1
        });
        
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process up to 5 webhooks in parallel
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs per second
      }
    }
  );

  worker.on('completed', (job) => {
    structuredLogger.info('Webhook worker completed job', {
      component: 'webhook-processor',
      jobId: job.id,
      returnValue: job.returnvalue
    });
  });

  worker.on('failed', (job, err) => {
    structuredLogger.error('Webhook worker job failed', err, {
      component: 'webhook-processor',
      jobId: job?.id,
      failedReason: job?.failedReason
    });
  });

  worker.on('error', (err) => {
    structuredLogger.error('Webhook worker error', err, {
      component: 'webhook-processor'
    });
  });

  return worker;
}

// Export for use in process managers
export default createWebhookProcessor;
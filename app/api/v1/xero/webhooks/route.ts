import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';
import { xeroWebhookSchema } from '@/lib/validation/schemas';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;
  if (!webhookKey) {
    structuredLogger.error('Webhook key not configured', undefined, { component: 'xero-webhooks' });
    return false;
  }

  const hash = crypto
    .createHmac('sha256', webhookKey)
    .update(payload)
    .digest('base64');

  return hash === signature;
}

// Intent to Receive (ITR) - Xero webhook verification
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-xero-signature');
    const rawBody = await request.text();

    // Handle Intent to Receive
    if (!rawBody || rawBody === '') {
      structuredLogger.info('Webhook ITR received', { component: 'xero-webhooks' });
      return NextResponse.json({ status: 'ok' });
    }

    // Verify signature
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      structuredLogger.warn('Invalid webhook signature', { 
        component: 'xero-webhooks',
        hasSignature: !!signature 
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const webhookData = xeroWebhookSchema.parse(JSON.parse(rawBody));
    
    structuredLogger.info('Webhook received', {
      component: 'xero-webhooks',
      eventCount: webhookData.events.length,
      firstSequence: webhookData.firstEventSequence,
      lastSequence: webhookData.lastEventSequence
    });

    // Process events asynchronously
    processWebhookEvents(webhookData.events).catch(error => {
      structuredLogger.error('Failed to process webhook events', error, { component: 'xero-webhooks' });
    });

    // Return immediately to acknowledge receipt
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    structuredLogger.error('Webhook processing error', error, { component: 'xero-webhooks' });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

async function processWebhookEvents(events: any[]) {
  const xeroData = await getXeroClientWithTenant();
  if (!xeroData) {
    structuredLogger.error('No Xero client available for webhook processing', undefined, { component: 'xero-webhooks' });
    return;
  }

  const { client, tenantId } = xeroData;
  
  for (const event of events) {
    try {
      await processWebhookEvent(client, tenantId, event);
    } catch (error) {
      structuredLogger.error('Failed to process webhook event', error, {
        component: 'xero-webhooks',
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        resourceId: event.resourceId
      });
    }
  }
}

async function processWebhookEvent(client: any, tenantId: string, event: any) {
  const { eventCategory, eventType, resourceId } = event;
  
  structuredLogger.info('Processing webhook event', {
    component: 'xero-webhooks',
    eventCategory,
    eventType,
    resourceId
  });

  switch (eventCategory) {
    case 'INVOICE':
      await processInvoiceEvent(client, tenantId, resourceId, eventType);
      break;
    case 'CONTACT':
      await processContactEvent(client, tenantId, resourceId, eventType);
      break;
    case 'PAYMENT':
      await processPaymentEvent(client, tenantId, resourceId, eventType);
      break;
    case 'BANKTRANSACTION':
      await processBankTransactionEvent(client, tenantId, resourceId, eventType);
      break;
    case 'BANKACCOUNT':
      await processBankAccountEvent(client, tenantId, resourceId, eventType);
      break;
  }
}

async function processInvoiceEvent(client: any, tenantId: string, invoiceId: string, eventType: string) {
  if (eventType === 'Delete') {
    await prisma.syncedInvoice.deleteMany({
      where: { id: invoiceId }
    });
    return;
  }

  // Fetch invoice from Xero
  const response = await client.accountingApi.getInvoice(tenantId, invoiceId);
  const invoice = response.body.invoices?.[0];
  
  if (!invoice) return;

  // Upsert invoice
  await prisma.syncedInvoice.upsert({
    where: { id: invoiceId },
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
    component: 'xero-webhooks',
    invoiceId,
    eventType,
    invoiceNumber: invoice.invoiceNumber
  });
}

async function processContactEvent(client: any, tenantId: string, contactId: string, eventType: string) {
  // Skip contact events as we don't have a Contact model
  structuredLogger.info('Contact webhook skipped - no Contact model', {
    component: 'xero-webhooks',
    contactId,
    eventType
  });
}

async function processPaymentEvent(client: any, tenantId: string, paymentId: string, eventType: string) {
  // Payments are typically part of invoices, so we'll fetch the related invoice
  try {
    const response = await client.accountingApi.getPayment(tenantId, paymentId);
    const payment = response.body.payments?.[0];
    
    if (payment?.invoice?.invoiceID) {
      // Trigger invoice update to reflect payment
      await processInvoiceEvent(client, tenantId, payment.invoice.invoiceID, 'Update');
    }
  } catch (error) {
    structuredLogger.error('Failed to process payment webhook', error, {
      component: 'xero-webhooks',
      paymentId
    });
  }
}

async function processBankTransactionEvent(client: any, tenantId: string, transactionId: string, eventType: string) {
  if (eventType === 'Delete') {
    await prisma.bankTransaction.deleteMany({
      where: { xeroTransactionId: transactionId }
    });
    return;
  }

  // Fetch transaction from Xero
  const response = await client.accountingApi.getBankTransaction(tenantId, transactionId);
  const transaction = response.body.bankTransactions?.[0];
  
  if (!transaction) return;

  // Get bank account
  const bankAccount = await prisma.bankAccount.findFirst({
    where: { code: transaction.bankAccount?.code }
  });

  if (!bankAccount) return;

  // Upsert transaction
  await prisma.bankTransaction.upsert({
    where: { xeroTransactionId: transactionId },
    create: {
      xeroTransactionId: transaction.bankTransactionID,
      type: transaction.type?.toString() || 'UNKNOWN',
      bankAccount: { connect: { id: bankAccount.id } },
      lineItems: JSON.stringify(transaction.lineItems || []),
      isReconciled: transaction.isReconciled || false,
      date: transaction.date ? new Date(transaction.date) : new Date(),
      reference: transaction.reference || null,
      currencyCode: transaction.currencyCode || null,
      status: transaction.status?.toString() || 'UNKNOWN',
      amount: transaction.total?.toNumber() || 0,
      description: transaction.lineItems?.[0]?.description || null,
      contactName: transaction.contact?.name || null
    },
    update: {
      type: transaction.type?.toString() || 'UNKNOWN',
      lineItems: JSON.stringify(transaction.lineItems || []),
      isReconciled: transaction.isReconciled || false,
      reference: transaction.reference || null,
      status: transaction.status?.toString() || 'UNKNOWN',
      amount: transaction.total?.toNumber() || 0,
      description: transaction.lineItems?.[0]?.description || null,
      contactName: transaction.contact?.name || null,
      lastSyncedAt: new Date()
    }
  });
}

async function processBankAccountEvent(client: any, tenantId: string, accountId: string, eventType: string) {
  if (eventType === 'Delete') {
    await prisma.bankAccount.deleteMany({
      where: { code: accountId }  // Assuming accountId is actually the account code
    });
    return;
  }

  // Fetch account from Xero
  const response = await client.accountingApi.getAccount(tenantId, accountId);
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
      accountNumber: account.bankAccountNumber || null
    },
    update: {
      name: account.name || '',
      code: account.code || null,
      status: account.status?.toString() || 'ACTIVE',
      currencyCode: account.currencyCode || null,
      accountNumber: account.bankAccountNumber || null
    }
  });
}
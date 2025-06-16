import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { BankTransaction } from 'xero-node';
import { executeXeroAPICall, paginatedXeroAPICall } from '@/lib/xero-client-with-rate-limit';
import { structuredLogger } from '@/lib/logger';
import { withIdempotency } from '@/lib/idempotency';
import { withValidation } from '@/lib/validation/middleware';
import { xeroSyncSchema } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/rate-limiter';

export const POST = withRateLimit(
  withValidation(
    { bodySchema: xeroSyncSchema },
    async (request, { body }) => {
    let syncLog: any;

    try {
      const forceFullSync = body?.forceFullSync || false;
    
    // Get last successful sync for incremental sync
    const lastSuccessfulSync = await prisma.syncLog.findFirst({
      where: { status: 'success' },
      orderBy: { completedAt: 'desc' }
    });
    
    const syncType = forceFullSync || !lastSuccessfulSync ? 'full_sync' : 'incremental_sync';
    const modifiedSince = !forceFullSync && lastSuccessfulSync?.completedAt || undefined;
    
    // Use idempotency for sync operations
    const idempotencyKey = {
      operation: 'xero_sync',
      syncType,
      modifiedSince: modifiedSince?.toISOString()
    };
    
    const result = await withIdempotency(idempotencyKey, async () => {
      // Use transaction for entire sync operation
      return await prisma.$transaction(async (tx) => {
        // Create sync log within transaction
        syncLog = await tx.syncLog.create({
          data: {
            syncType,
            status: 'in_progress',
            startedAt: new Date()
          }
        });

        return await performSync(tx, syncLog, modifiedSince);
      }, {
        maxWait: 5000, // 5 seconds max wait
        timeout: 600000, // 10 minutes timeout for long sync operations
      });
    });

    return NextResponse.json(result);
  } catch (error: any) {
    structuredLogger.error('Sync error', error, { component: 'xero-sync' });
    
    // Update sync log if it was created
    if (syncLog?.id) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message
        }
      });
    }
    
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message
    }, { status: 500 });
  }
  }
  )
)

async function performSync(tx: any, syncLog: any, modifiedSince?: Date) {
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
      modifiedSince: modifiedSince?.toISOString()
    });
    
    let totalAccounts = 0;
    let totalTransactions = 0;
    let createdTransactions = 0;
    let updatedTransactions = 0;
    let totalGLAccounts = 0;
    
    // Step 1: Sync all GL accounts (Chart of Accounts) first
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
    
    // Step 2: Sync all bank accounts with rate limiting
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
    
    // Upsert bank accounts
    for (const account of bankAccounts) {
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
    
    console.log(`Synced ${totalAccounts} bank accounts`);
    
    // Step 3: Fetch transactions for EACH bank account
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      console.log(`\nFetching transactions for ${account.name} (${account.currencyCode})...`);
      
      const dbAccount = await tx.bankAccount.findUnique({
        where: { xeroAccountId: account.accountID }
      });
      
      if (!dbAccount) continue;
      
      let accountTransactions = 0;
      
      // Use paginated API call with rate limiting
      const transactionPages = paginatedXeroAPICall(
        tenant.tenantId,
        async (client, pageNum) => {
          console.log(`  Fetching page ${pageNum} for ${account.name}...`);
          const response = await client.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined, // If-Modified-Since
            `BankAccount.AccountID=Guid("${account.accountID}")`, // Filter by account
            undefined, // Order
            100, // Page size
            undefined, // unitdp
            pageNum // Page number
          );
          
          const transactions = response.body.bankTransactions || [];
          console.log(`  Page ${pageNum}: ${transactions.length} transactions`);
          
          return {
            items: transactions,
            hasMore: transactions.length === 100
          };
        },
        { maxPages: 100, delayBetweenPages: 500 } // 500ms delay between pages
      );
      
      // Process transactions as they come in
      for await (const transactions of transactionPages) {
          // Process each transaction
          for (const tx of transactions) {
            if (!tx.bankTransactionID) continue;
            
            // Prepare line items as JSON string
            const lineItemsJson = tx.lineItems ? JSON.stringify(tx.lineItems) : null;
            
            // Upsert transaction
            const existing = await prisma.bankTransaction.findUnique({
              where: { xeroTransactionId: tx.bankTransactionID }
            });
            
            await prisma.bankTransaction.upsert({
              where: { xeroTransactionId: tx.bankTransactionID },
              update: {
                bankAccountId: dbAccount.id,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                status: tx.status?.toString() || 'AUTHORISED',
                isReconciled: tx.isReconciled || false,
                reference: tx.reference || null,
                description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
                contactName: tx.contact?.name || null,
                lineItems: lineItemsJson,
                hasAttachments: tx.hasAttachments || false,
                lastSyncedAt: new Date()
              },
              create: {
                xeroTransactionId: tx.bankTransactionID,
                bankAccountId: dbAccount.id,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                status: tx.status?.toString() || 'AUTHORISED',
                isReconciled: tx.isReconciled || false,
                reference: tx.reference || null,
                description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
                contactName: tx.contact?.name || null,
                lineItems: lineItemsJson,
                hasAttachments: tx.hasAttachments || false
              }
            });
            
            if (existing) {
              updatedTransactions++;
            } else {
              createdTransactions++;
            }
            
            accountTransactions++;
            totalTransactions++;
          }
      }
      
      structuredLogger.debug('Account sync complete', { 
        component: 'xero-sync',
        accountName: account.name,
        transactionCount: accountTransactions 
      });
    }
    
    // Update sync log
    await tx.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated: createdTransactions,
        recordsUpdated: updatedTransactions,
        details: JSON.stringify({
          glAccounts: totalGLAccounts,
          bankAccounts: totalAccounts,
          transactions: totalTransactions,
          bankAccountBreakdown: await tx.bankTransaction.groupBy({
            by: ['bankAccountId'],
            _count: true
          })
        })
      }
    });
    
    // Step 4: Sync open invoices for cash flow forecasting
    structuredLogger.debug('Fetching open invoices', { component: 'xero-sync' });
    let totalInvoices = 0;
    let totalBills = 0;
    
    try {
      // Fetch customer invoices (ACCREC)
      const customerInvoicesResponse = await executeXeroAPICall(
        tenant.tenantId,
        async (client) => client.accountingApi.getInvoices(
          tenant.tenantId,
          undefined,
          'Status=="AUTHORISED"&&Type=="ACCREC"',
          undefined,
          undefined,
          undefined,
          undefined,
          ['AUTHORISED'],
          100
        )
      );
      
      const customerInvoices = customerInvoicesResponse.body.invoices || [];
      structuredLogger.info('Customer invoices retrieved', { 
        component: 'xero-sync',
        count: customerInvoices.length 
      });
      
      // Upsert customer invoices
      for (const invoice of customerInvoices) {
        if (!invoice.invoiceID || invoice.amountDue === 0) continue;
        
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
      }
      
      // Fetch supplier bills (ACCPAY)
      const supplierBillsResponse = await executeXeroAPICall(
        tenant.tenantId,
        async (client) => client.accountingApi.getInvoices(
          tenant.tenantId,
          undefined,
          'Status=="AUTHORISED"&&Type=="ACCPAY"',
          undefined,
          undefined,
          undefined,
          undefined,
          ['AUTHORISED'],
          100
        )
      );
      
      const supplierBills = supplierBillsResponse.body.invoices || [];
      structuredLogger.info('Supplier bills retrieved', { 
        component: 'xero-sync',
        count: supplierBills.length 
      });
      
      // Upsert supplier bills
      for (const bill of supplierBills) {
        if (!bill.invoiceID || bill.amountDue === 0) continue;
        
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
      }
    } catch (invoiceError) {
      structuredLogger.error('Error syncing invoices', invoiceError, { component: 'xero-sync' });
    }

    structuredLogger.info('Sync completed successfully', {
      component: 'xero-sync',
      glAccounts: totalGLAccounts,
      bankAccounts: totalAccounts,
      totalTransactions,
      customerInvoices: totalInvoices,
      supplierBills: totalBills,
      created: createdTransactions,
      updated: updatedTransactions
    });
    
    return {
      success: true,
      summary: {
        glAccounts: totalGLAccounts,
        bankAccounts: totalAccounts,
        transactions: totalTransactions,
        invoices: totalInvoices,
        bills: totalBills,
        created: createdTransactions,
        updated: updatedTransactions
      }
    };
    
  } catch (error: any) {
    structuredLogger.error('Sync error', error, { component: 'xero-sync' });
    
    await tx.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
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
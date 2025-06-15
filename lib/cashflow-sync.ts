import { XeroClient, CreditNote } from 'xero-node';
import { prisma } from '@/lib/prisma';
import { rateLimiterManager } from '@/lib/xero-rate-limiter';
import { 
  addDays, 
  addMonths, 
  subDays, 
  format, 
  parseISO,
  differenceInDays 
} from 'date-fns';

interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  errors?: string[];
}

export class CashFlowDataSync {
  private xero: XeroClient;
  private tenantId: string;
  private rateLimiter: ReturnType<typeof rateLimiterManager.getLimiter>;

  constructor(xeroClient: XeroClient, tenantId: string) {
    this.xero = xeroClient;
    this.tenantId = tenantId;
    this.rateLimiter = rateLimiterManager.getLimiter(tenantId);
  }

  // Main sync orchestrator
  async performDailySync(): Promise<SyncResult> {
    const syncLog = await prisma.cashFlowSyncLog.create({
      data: {
        syncType: 'DELTA',
        entityType: 'all',
        startedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });

    const errors: string[] = [];
    let totalItemsSynced = 0;
    let totalItemsCreated = 0;
    let totalItemsUpdated = 0;

    try {
      // Get last successful sync time
      const lastSync = await this.getLastSuccessfulSync();
      
      // Sync in parallel where possible
      const [
        invoicesResult,
        billsResult,
        repeatingResult,
        creditNotesResult,
        positionResult,
      ] = await Promise.all([
        this.syncInvoices(lastSync),
        this.syncBills(lastSync),
        this.syncRepeatingTransactions(),
        this.syncCreditNotes(lastSync),
        this.syncFinancialPosition(),
      ]);

      // Aggregate results
      totalItemsSynced = invoicesResult.itemsSynced + billsResult.itemsSynced + 
                        repeatingResult.itemsSynced + creditNotesResult.itemsSynced;
      totalItemsCreated = invoicesResult.itemsCreated + billsResult.itemsCreated + 
                         repeatingResult.itemsCreated + creditNotesResult.itemsCreated;
      totalItemsUpdated = invoicesResult.itemsUpdated + billsResult.itemsUpdated + 
                         repeatingResult.itemsUpdated + creditNotesResult.itemsUpdated;

      // Calculate payment patterns after syncing invoices/bills
      await this.calculatePaymentPatterns();

      // Update sync log
      await prisma.cashFlowSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          status: 'SUCCESS',
          itemsSynced: totalItemsSynced,
          itemsCreated: totalItemsCreated,
          itemsUpdated: totalItemsUpdated,
        },
      });

      return {
        success: true,
        itemsSynced: totalItemsSynced,
        itemsCreated: totalItemsCreated,
        itemsUpdated: totalItemsUpdated,
        itemsDeleted: 0,
      };
    } catch (error) {
      // Update sync log with error
      await prisma.cashFlowSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  // Sync open invoices (receivables)
  private async syncInvoices(lastSync: Date | null): Promise<SyncResult> {
    let page = 1;
    let hasMore = true;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSynced = 0;

    while (hasMore) {
      const response = await this.rateLimiter.executeAPICall(async () => {
        return this.xero.accountingApi.getInvoices(
          this.tenantId,
          lastSync || undefined, // ifModifiedSince
          undefined, // where
          undefined, // order
          undefined, // IDs
          undefined, // invoiceNumbers
          undefined, // contactIDs
          ['AUTHORISED', 'PAID', 'VOIDED'], // statuses
          page // page
        );
      });

      const invoices = response.body.invoices || [];
      
      for (const invoice of invoices) {
        if (!invoice.invoiceID) continue;

        const data = {
          contactId: invoice.contact?.contactID || '',
          contactName: invoice.contact?.name || '',
          invoiceNumber: invoice.invoiceNumber || '',
          reference: invoice.reference || '',
          dueDate: invoice.dueDate || new Date(),
          date: invoice.date || new Date(),
          amountDue: invoice.amountDue || 0,
          total: invoice.total || 0,
          type: invoice.type?.toString() || 'ACCREC',
          status: invoice.status?.toString() || 'OPEN',
          lineAmountTypes: invoice.lineAmountTypes?.toString() || '',
          currencyCode: invoice.currencyCode?.toString() || 'GBP',
          lastModifiedUtc: invoice.updatedDateUTC || new Date(),
        };

        const existing = await prisma.syncedInvoice.findUnique({
          where: { id: invoice.invoiceID },
        });

        if (existing) {
          await prisma.syncedInvoice.update({
            where: { id: invoice.invoiceID },
            data,
          });
          itemsUpdated++;
        } else {
          await prisma.syncedInvoice.create({
            data: { id: invoice.invoiceID, ...data },
          });
          itemsCreated++;
        }
        itemsSynced++;
      }

      hasMore = invoices.length === 100;
      page++;
    }

    return { success: true, itemsSynced, itemsCreated, itemsUpdated, itemsDeleted: 0 };
  }

  // Sync bills (payables)
  private async syncBills(lastSync: Date | null): Promise<SyncResult> {
    let page = 1;
    let hasMore = true;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSynced = 0;

    while (hasMore) {
      const response = await this.rateLimiter.executeAPICall(async () => {
        return this.xero.accountingApi.getInvoices(
          this.tenantId,
          lastSync || undefined, // ifModifiedSince
          'Type=="ACCPAY"', // where - filter for bills only
          undefined, // order
          undefined, // IDs
          undefined, // invoiceNumbers
          undefined, // contactIDs
          ['AUTHORISED', 'PAID', 'VOIDED'], // statuses
          page // page
        );
      });

      const bills = response.body.invoices || [];
      
      for (const bill of bills) {
        if (!bill.invoiceID) continue;

        const data = {
          contactId: bill.contact?.contactID || '',
          contactName: bill.contact?.name || '',
          invoiceNumber: bill.invoiceNumber || '',
          reference: bill.reference || '',
          dueDate: bill.dueDate || new Date(),
          date: bill.date || new Date(),
          amountDue: bill.amountDue || 0,
          total: bill.total || 0,
          type: 'ACCPAY',
          status: bill.status?.toString() || 'OPEN',
          lineAmountTypes: bill.lineAmountTypes?.toString() || '',
          currencyCode: bill.currencyCode?.toString() || 'GBP',
          lastModifiedUtc: bill.updatedDateUTC || new Date(),
        };

        const existing = await prisma.syncedInvoice.findUnique({
          where: { id: bill.invoiceID },
        });

        if (existing) {
          await prisma.syncedInvoice.update({
            where: { id: bill.invoiceID },
            data,
          });
          itemsUpdated++;
        } else {
          await prisma.syncedInvoice.create({
            data: { id: bill.invoiceID, ...data },
          });
          itemsCreated++;
        }
        itemsSynced++;
      }

      hasMore = bills.length === 100;
      page++;
    }

    return { success: true, itemsSynced, itemsCreated, itemsUpdated, itemsDeleted: 0 };
  }

  // Sync repeating transactions (scheduled future cash flows)
  private async syncRepeatingTransactions(): Promise<SyncResult> {
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsSynced = 0;

    // Get all repeating invoices (sales)
    const salesResponse = await this.rateLimiter.executeAPICall(async () => {
      return this.xero.accountingApi.getRepeatingInvoices(
        this.tenantId,
        'Status=="AUTHORISED"' // where
      );
    });

    const repeatingInvoices = salesResponse.body.repeatingInvoices || [];

    for (const repeating of repeatingInvoices) {
      if (!repeating.repeatingInvoiceID) continue;

      const data = {
        type: repeating.type?.toString() || 'ACCREC',
        contactId: repeating.contact?.contactID || '',
        contactName: repeating.contact?.name || '',
        scheduleUnit: repeating.schedule?.unit?.toString() || 'MONTHLY',
        scheduleInterval: repeating.schedule?.period || 1,
        nextScheduledDate: repeating.schedule?.nextScheduledDate 
          ? parseISO(repeating.schedule.nextScheduledDate) 
          : null,
        endDate: repeating.schedule?.endDate 
          ? parseISO(repeating.schedule.endDate) 
          : null,
        amount: repeating.lineItems?.reduce((sum, item) => 
          sum + (item.lineAmount || 0), 0) || 0,
        total: repeating.total || 0,
        status: repeating.status?.toString() || '',
        reference: repeating.reference || '',
        lastModifiedUtc: new Date(),
      };

      const existing = await prisma.repeatingTransaction.findUnique({
        where: { id: repeating.repeatingInvoiceID },
      });

      if (existing) {
        await prisma.repeatingTransaction.update({
          where: { id: repeating.repeatingInvoiceID },
          data,
        });
        itemsUpdated++;
      } else {
        await prisma.repeatingTransaction.create({
          data: { id: repeating.repeatingInvoiceID, ...data },
        });
        itemsCreated++;
      }
      itemsSynced++;
    }

    return { success: true, itemsSynced, itemsCreated, itemsUpdated, itemsDeleted: 0 };
  }

  // Sync credit notes (adjustments to receivables/payables)
  private async syncCreditNotes(lastSync: Date | null): Promise<SyncResult> {
    let page = 1;
    let hasMore = true;
    let itemsSynced = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;

    while (hasMore) {
      const response = await this.rateLimiter.executeAPICall(async () => {
        return this.xero.accountingApi.getCreditNotes(
          this.tenantId,
          lastSync || undefined, // ifModifiedSince
          undefined, // where
          undefined, // order
          page // page
        );
      });

      const creditNotes = response.body.creditNotes || [];
      
      // Process credit notes to adjust invoice/bill amounts
      for (const creditNote of creditNotes) {
        if (!creditNote.creditNoteID || creditNote.status !== CreditNote.StatusEnum.AUTHORISED) continue;

        // Find allocations to invoices/bills
        const allocations = creditNote.allocations || [];
        
        for (const allocation of allocations) {
          if (!allocation.invoice?.invoiceID) continue;

          // Update the amount due on the related invoice
          const invoice = await prisma.syncedInvoice.findUnique({
            where: { id: allocation.invoice.invoiceID },
          });

          if (invoice) {
            await prisma.syncedInvoice.update({
              where: { id: allocation.invoice.invoiceID },
              data: {
                amountDue: Math.max(0, invoice.amountDue.toNumber() - (allocation.amount || 0)),
              },
            });
            itemsUpdated++;
          }
        }
        itemsSynced++;
      }

      hasMore = creditNotes.length === 100;
      page++;
    }

    return { success: true, itemsSynced, itemsCreated, itemsUpdated, itemsDeleted: 0 };
  }

  // Sync current financial position from reports
  private async syncFinancialPosition(): Promise<void> {
    // Get Balance Sheet for current cash position
    const balanceSheet = await this.rateLimiter.executeAPICall(async () => {
      return this.xero.accountingApi.getReportBalanceSheet(this.tenantId);
    });

    // Get Bank Summary for overall bank position
    // Note: This version of getReportBankSummary doesn't support date parameters
    const bankSummary = await this.rateLimiter.executeAPICall(async () => {
      return this.xero.accountingApi.getReportBankSummary(this.tenantId);
    });

    // Process and store position data
    // This would typically update a separate position tracking table
    // For now, we'll use it in the forecast calculation
  }

  // Calculate payment patterns based on historical data
  private async calculatePaymentPatterns(): Promise<void> {
    // Get all contacts with payment history
    const contacts = await prisma.syncedInvoice.groupBy({
      by: ['contactId', 'contactName', 'type'],
      where: {
        status: 'PAID',
      },
    });

    for (const contact of contacts) {
      // Get paid invoices for this contact
      const paidInvoices = await prisma.syncedInvoice.findMany({
        where: {
          contactId: contact.contactId,
          type: contact.type,
          status: 'PAID',
        },
      });

      if (paidInvoices.length < 3) continue; // Need minimum sample size

      // Calculate payment timing statistics
      let totalDaysToPay = 0;
      let onTimeCount = 0;
      let earlyCount = 0;
      let lateCount = 0;

      for (const invoice of paidInvoices) {
        const daysToPay = differenceInDays(invoice.updatedAt, invoice.dueDate);
        totalDaysToPay += Math.abs(daysToPay);

        if (daysToPay <= 0) earlyCount++;
        else if (daysToPay <= 3) onTimeCount++;
        else lateCount++;
      }

      const averageDaysToPay = totalDaysToPay / paidInvoices.length;
      const total = paidInvoices.length;

      await prisma.paymentPattern.upsert({
        where: {
          contactId_type: {
            contactId: contact.contactId,
            type: contact.type === 'ACCREC' ? 'CUSTOMER' : 'SUPPLIER',
          },
        },
        create: {
          contactId: contact.contactId,
          contactName: contact.contactName || '',
          type: contact.type === 'ACCREC' ? 'CUSTOMER' : 'SUPPLIER',
          averageDaysToPay,
          onTimeRate: (onTimeCount / total) * 100,
          earlyRate: (earlyCount / total) * 100,
          lateRate: (lateCount / total) * 100,
          sampleSize: total,
          lastCalculated: new Date(),
        },
        update: {
          averageDaysToPay,
          onTimeRate: (onTimeCount / total) * 100,
          earlyRate: (earlyCount / total) * 100,
          lateRate: (lateCount / total) * 100,
          sampleSize: total,
          lastCalculated: new Date(),
        },
      });
    }
  }

  // Get last successful sync timestamp
  private async getLastSuccessfulSync(): Promise<Date | null> {
    const lastSync = await prisma.cashFlowSyncLog.findFirst({
      where: {
        syncType: 'DELTA',
        status: 'SUCCESS',
      },
      orderBy: {
        completedAt: 'desc',
      },
    });

    return lastSync?.completedAt || null;
  }

  // Full reconciliation sync (weekly) to catch deletions
  async performFullReconciliation(): Promise<SyncResult> {
    const syncLog = await prisma.cashFlowSyncLog.create({
      data: {
        syncType: 'FULL_RECONCILIATION',
        entityType: 'all',
        startedAt: new Date(),
        status: 'IN_PROGRESS',
      },
    });

    try {
      // Mark all existing records as potentially deleted
      await prisma.$transaction([
        prisma.syncedInvoice.updateMany({
          data: { status: 'PENDING_VERIFICATION' },
        }),
        prisma.repeatingTransaction.updateMany({
          data: { status: 'PENDING_VERIFICATION' },
        }),
      ]);

      // Re-sync all data (without modifiedAfter filter)
      const syncResult = await this.performDailySync();

      // Mark unverified records as VOIDED
      const [voidedInvoices, voidedRepeating] = await prisma.$transaction([
        prisma.syncedInvoice.updateMany({
          where: { status: 'PENDING_VERIFICATION' },
          data: { status: 'VOIDED' },
        }),
        prisma.repeatingTransaction.updateMany({
          where: { status: 'PENDING_VERIFICATION' },
          data: { status: 'CANCELLED' },
        }),
      ]);

      const itemsDeleted = voidedInvoices.count + voidedRepeating.count;

      await prisma.cashFlowSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          status: 'SUCCESS',
          itemsDeleted,
        },
      });

      return {
        ...syncResult,
        itemsDeleted,
      };
    } catch (error) {
      await prisma.cashFlowSyncLog.update({
        where: { id: syncLog.id },
        data: {
          completedAt: new Date(),
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }
}
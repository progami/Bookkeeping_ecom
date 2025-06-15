import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { redis } from '@/lib/redis';
import { 
  addDays, 
  addMonths,
  startOfDay,
  endOfDay,
  format,
  differenceInDays,
  isAfter,
  isBefore,
  isWithinInterval
} from 'date-fns';
import { UKTaxCalculator } from './uk-tax-calculator';

export interface DailyForecast {
  date: Date;
  openingBalance: number;
  inflows: {
    fromInvoices: number;
    fromRepeating: number;
    fromOther: number;
    total: number;
  };
  outflows: {
    toBills: number;
    toRepeating: number;
    toTaxes: number;
    toPatterns: number;
    toBudgets: number;
    total: number;
  };
  closingBalance: number;
  scenarios: {
    bestCase: number;
    worstCase: number;
  };
  confidenceLevel: number;
  alerts: Alert[];
}

interface Alert {
  type: 'LOW_BALANCE' | 'LARGE_PAYMENT' | 'TAX_DUE' | 'OVERDUE_INVOICE';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  amount?: number;
}

interface CashPosition {
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
}

export class CashFlowEngine {
  private confidenceLevels = {
    bankBalance: 1.0,        // 100% certain
    repeatingInvoice: 0.98,  // 98% - confirmed schedule
    confirmedInvoice: 0.95,  // 95% - might pay late
    inferredPattern: 0.75,   // 75% - based on patterns
    budgeted: 0.60          // 60% - an estimate/goal
  };

  private taxCalculator: UKTaxCalculator;

  constructor() {
    this.taxCalculator = new UKTaxCalculator();
  }

  async generateForecast(days: number = 90): Promise<DailyForecast[]> {
    // Check if we have a recent forecast cached
    const cacheKey = `forecast:${days}`;
    const cached = await redis.get(`bookkeeping:${cacheKey}`);
    if (cached) {
      try {
        const parsedCache = JSON.parse(cached);
        // Check if cache is less than 5 minutes old
        if (parsedCache.timestamp && Date.now() - parsedCache.timestamp < 5 * 60 * 1000) {
          console.log('[CashFlow] Returning cached forecast');
          return parsedCache.data;
        }
      } catch (e) {
        console.error('[CashFlow] Cache parse error:', e);
      }
    }
    
    // Get current position
    const currentPosition = await this.getCurrentPosition();
    
    // Get all the data we need
    const [
      openInvoices,
      openBills,
      repeatingTransactions,
      paymentPatterns,
      budgets,
      taxObligations,
    ] = await Promise.all([
      this.getOpenInvoices(),
      this.getOpenBills(),
      this.getRepeatingTransactions(days),
      this.getPaymentPatterns(),
      this.getBudgets(days),
      this.getTaxObligations(days),
    ]);

    // Build forecast day by day
    const forecast: DailyForecast[] = [];
    let runningBalance = currentPosition.cash;

    for (let day = 0; day < days; day++) {
      const forecastDate = addDays(new Date(), day);
      const dayStart = startOfDay(forecastDate);
      
      // Calculate inflows
      const invoiceInflows = await this.calculateInvoiceInflows(
        dayStart,
        openInvoices,
        paymentPatterns
      );
      
      const repeatingInflows = this.calculateRepeatingFlows(
        dayStart,
        repeatingTransactions.filter(rt => rt.type === 'ACCREC')
      );

      // Calculate outflows
      const billOutflows = await this.calculateBillOutflows(
        dayStart,
        openBills,
        paymentPatterns
      );
      
      const repeatingOutflows = this.calculateRepeatingFlows(
        dayStart,
        repeatingTransactions.filter(rt => rt.type === 'ACCPAY')
      );
      
      const taxOutflows = this.calculateTaxPayments(dayStart, taxObligations);
      
      const patternOutflows = await this.calculatePatternBasedOutflows(dayStart);
      
      const budgetOutflows = this.calculateBudgetedOutflows(
        dayStart,
        budgets,
        invoiceInflows + repeatingInflows,
        billOutflows + repeatingOutflows + taxOutflows
      );

      // Calculate totals
      const totalInflows = invoiceInflows + repeatingInflows;
      const totalOutflows = billOutflows + repeatingOutflows + taxOutflows + 
                           patternOutflows + budgetOutflows;
      
      const closingBalance = runningBalance + totalInflows - totalOutflows;

      // Calculate scenarios
      const scenarios = this.calculateScenarios(
        runningBalance,
        totalInflows,
        totalOutflows
      );

      // Generate alerts
      const alerts = this.generateAlerts(
        dayStart,
        closingBalance,
        totalOutflows,
        taxOutflows,
        openInvoices
      );

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(
        invoiceInflows,
        repeatingInflows,
        billOutflows,
        repeatingOutflows,
        patternOutflows,
        budgetOutflows
      );

      forecast.push({
        date: dayStart,
        openingBalance: runningBalance,
        inflows: {
          fromInvoices: invoiceInflows,
          fromRepeating: repeatingInflows,
          fromOther: 0,
          total: totalInflows,
        },
        outflows: {
          toBills: billOutflows,
          toRepeating: repeatingOutflows,
          toTaxes: taxOutflows,
          toPatterns: patternOutflows,
          toBudgets: budgetOutflows,
          total: totalOutflows,
        },
        closingBalance,
        scenarios,
        confidenceLevel,
        alerts,
      });

      // Don't store each day individually to reduce DB writes
      // await this.storeForecast(forecast[forecast.length - 1]);

      runningBalance = closingBalance;
    }
    
    // Store all forecasts in batch at the end
    await this.storeForecastBatch(forecast);
    
    // Cache the result
    await redis.set(
      `bookkeeping:forecast:${days}`,
      JSON.stringify({ data: forecast, timestamp: Date.now() }),
      'EX',
      300 // 5 minute cache
    );

    return forecast;
  }

  private async getCurrentPosition(): Promise<CashPosition> {
    try {
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        throw new Error('Xero not connected');
      }
      
      const { client, tenantId } = xeroData;
      
      // Get real bank balances from Xero
      const accountsResponse = await client.accountingApi.getAccounts(
        tenantId,
        undefined,
        'Type=="BANK"',
        undefined
      );
      
      let totalCash = 0;
      if (accountsResponse.body?.accounts) {
        accountsResponse.body.accounts.forEach((account: any) => {
          if (account.type === 'BANK' && account.status === 'ACTIVE') {
            totalCash += account.balance || 0;
          }
        });
      }
      
      // Get accounts receivable and payable from Balance Sheet
      const balanceSheetResponse = await client.accountingApi.getReportBalanceSheet(
        tenantId,
        new Date().toISOString()
      );
      
      let accountsReceivable = 0;
      let accountsPayable = 0;
      
      if (balanceSheetResponse.body?.reports?.[0]?.rows) {
        balanceSheetResponse.body.reports[0].rows.forEach((row: any) => {
          if (row.rowType === 'Row' && row.cells) {
            const accountName = row.cells[0]?.value || '';
            const amount = parseFloat(row.cells[row.cells.length - 1]?.value || '0');
            
            if (accountName.toLowerCase().includes('accounts receivable') ||
                accountName.toLowerCase().includes('debtors')) {
              accountsReceivable = amount;
            } else if (accountName.toLowerCase().includes('accounts payable') ||
                       accountName.toLowerCase().includes('creditors')) {
              accountsPayable = amount;
            }
          }
        });
      }
      
      return {
        cash: totalCash,
        accountsReceivable,
        accountsPayable
      };
    } catch (error) {
      console.error('Error getting current position from Xero:', error);
      // Fallback to database if Xero fails
      const bankAccounts = await prisma.bankAccount.findMany({
        where: { status: 'ACTIVE' },
      });
      
      const cash = bankAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      // Get accounts receivable (open invoices)
      const receivables = await prisma.syncedInvoice.aggregate({
        where: {
          type: 'ACCREC',
          status: 'OPEN',
        },
        _sum: {
          amountDue: true,
        },
      });

      // Get accounts payable (open bills)
      const payables = await prisma.syncedInvoice.aggregate({
        where: {
          type: 'ACCPAY',
          status: 'OPEN',
        },
        _sum: {
          amountDue: true,
        },
      });

      return {
        cash,
        accountsReceivable: receivables._sum.amountDue || 0,
        accountsPayable: payables._sum.amountDue || 0,
      };
    }
  }

  private async getOpenInvoices() {
    try {
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        // Fallback to database
        return prisma.syncedInvoice.findMany({
          where: {
            type: 'ACCREC',
            status: 'OPEN',
            amountDue: { gt: 0 },
          },
          orderBy: { dueDate: 'asc' },
        });
      }
      
      const { client, tenantId } = xeroData;
      
      // Get open invoices from Xero
      const response = await client.accountingApi.getInvoices(
        tenantId,
        undefined,
        'Status=="AUTHORISED"',
        undefined,
        undefined,
        undefined,
        undefined,
        ['AUTHORISED'],
        100
      );
      
      const openInvoices: any[] = [];
      
      if (response.body?.invoices) {
        response.body.invoices.forEach((invoice: any) => {
          if (invoice.type === 'ACCREC' && invoice.amountDue > 0) {
            openInvoices.push({
              id: invoice.invoiceID,
              contactId: invoice.contact?.contactID,
              contactName: invoice.contact?.name,
              invoiceNumber: invoice.invoiceNumber,
              dueDate: new Date(invoice.dueDate || invoice.dueDateString),
              date: new Date(invoice.date || invoice.dateString),
              amountDue: invoice.amountDue,
              total: invoice.total,
              type: 'ACCREC',
              status: 'OPEN'
            });
          }
        });
      }
      
      return openInvoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    } catch (error) {
      console.error('Error fetching open invoices from Xero:', error);
      // Fallback to database
      return prisma.syncedInvoice.findMany({
        where: {
          type: 'ACCREC',
          status: 'OPEN',
          amountDue: { gt: 0 },
        },
        orderBy: { dueDate: 'asc' },
      });
    }
  }

  private async getOpenBills() {
    try {
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        // Fallback to database
        return prisma.syncedInvoice.findMany({
          where: {
            type: 'ACCPAY',
            status: 'OPEN',
            amountDue: { gt: 0 },
          },
          orderBy: { dueDate: 'asc' },
        });
      }
      
      const { client, tenantId } = xeroData;
      
      // Get open bills from Xero
      const response = await client.accountingApi.getInvoices(
        tenantId,
        undefined,
        'Type=="ACCPAY"&&Status=="AUTHORISED"',
        undefined,
        undefined,
        undefined,
        undefined,
        ['AUTHORISED'],
        100
      );
      
      const openBills: any[] = [];
      
      if (response.body?.invoices) {
        response.body.invoices.forEach((invoice: any) => {
          if (invoice.type === 'ACCPAY' && invoice.amountDue > 0) {
            openBills.push({
              id: invoice.invoiceID,
              contactId: invoice.contact?.contactID,
              contactName: invoice.contact?.name,
              invoiceNumber: invoice.invoiceNumber,
              dueDate: new Date(invoice.dueDate || invoice.dueDateString),
              date: new Date(invoice.date || invoice.dateString),
              amountDue: invoice.amountDue,
              total: invoice.total,
              type: 'ACCPAY',
              status: 'OPEN'
            });
          }
        });
      }
      
      return openBills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    } catch (error) {
      console.error('Error fetching open bills from Xero:', error);
      // Fallback to database
      return prisma.syncedInvoice.findMany({
        where: {
          type: 'ACCPAY',
          status: 'OPEN',
          amountDue: { gt: 0 },
        },
        orderBy: { dueDate: 'asc' },
      });
    }
  }

  private async getRepeatingTransactions(days: number) {
    try {
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        // Fallback to database
        const endDate = addDays(new Date(), days);
        return prisma.repeatingTransaction.findMany({
          where: {
            status: 'AUTHORISED',
            OR: [
              { endDate: null },
              { endDate: { gte: new Date() } },
            ],
            nextScheduledDate: {
              lte: endDate,
            },
          },
        });
      }
      
      const { client, tenantId } = xeroData;
      
      // Get repeating invoices from Xero
      const response = await client.accountingApi.getRepeatingInvoices(
        tenantId,
        undefined,
        'Status=="AUTHORISED"'
      );
      
      const repeatingTransactions: any[] = [];
      const endDate = addDays(new Date(), days);
      
      if (response.body?.repeatingInvoices) {
        response.body.repeatingInvoices.forEach((invoice: any) => {
          if (invoice.status === 'AUTHORISED') {
            // Calculate next scheduled dates based on schedule
            const nextDate = invoice.schedule?.nextScheduledDate 
              ? new Date(invoice.schedule.nextScheduledDate)
              : null;
              
            if (nextDate && nextDate <= endDate) {
              repeatingTransactions.push({
                id: invoice.repeatingInvoiceID,
                type: invoice.type,
                contactId: invoice.contact?.contactID,
                contactName: invoice.contact?.name,
                scheduleUnit: invoice.schedule?.unit,
                scheduleInterval: invoice.schedule?.dueDate || 0,
                nextScheduledDate: nextDate,
                endDate: invoice.schedule?.endDate ? new Date(invoice.schedule.endDate) : null,
                amount: invoice.total || 0,
                total: invoice.total || 0,
                status: 'AUTHORISED'
              });
            }
          }
        });
      }
      
      return repeatingTransactions;
    } catch (error) {
      console.error('Error fetching repeating transactions from Xero:', error);
      // Fallback to database
      const endDate = addDays(new Date(), days);
      return prisma.repeatingTransaction.findMany({
        where: {
          status: 'AUTHORISED',
          OR: [
            { endDate: null },
            { endDate: { gte: new Date() } },
          ],
          nextScheduledDate: {
            lte: endDate,
          },
        },
      });
    }
  }

  private async getPaymentPatterns() {
    return prisma.paymentPattern.findMany();
  }

  private async getBudgets(days: number) {
    // Get budgets for the forecast period
    const months = Math.ceil(days / 30);
    const monthYears: string[] = [];
    
    for (let i = 0; i < months; i++) {
      const date = addMonths(new Date(), i);
      monthYears.push(format(date, 'yyyy-MM'));
    }

    return prisma.cashFlowBudget.findMany({
      where: {
        monthYear: { in: monthYears },
      },
    });
  }

  private async getTaxObligations(days: number) {
    const endDate = addDays(new Date(), days);
    
    // Get existing tax obligations
    const existingObligations = await prisma.taxObligation.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: new Date(),
          lte: endDate,
        },
      },
    });

    // Calculate upcoming tax obligations
    const calculatedObligations = await this.taxCalculator.calculateUpcomingTaxes(days);
    
    // Merge and deduplicate
    return [...existingObligations, ...calculatedObligations];
  }

  private async calculateInvoiceInflows(
    date: Date,
    openInvoices: any[],
    paymentPatterns: any[]
  ): Promise<number> {
    let totalInflow = 0;

    for (const invoice of openInvoices) {
      // Get payment pattern for this customer
      const pattern = paymentPatterns.find(
        p => p.contactId === invoice.contactId && p.type === 'CUSTOMER'
      );

      // Calculate expected payment date
      const expectedPaymentDate = pattern
        ? addDays(invoice.dueDate, pattern.averageDaysToPay)
        : invoice.dueDate;

      // Check if payment is expected on this date
      if (format(expectedPaymentDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
        totalInflow += invoice.amountDue;
      }
    }

    return totalInflow;
  }

  private async calculateBillOutflows(
    date: Date,
    openBills: any[],
    paymentPatterns: any[]
  ): Promise<number> {
    let totalOutflow = 0;

    for (const bill of openBills) {
      // Get payment pattern for this supplier
      const pattern = paymentPatterns.find(
        p => p.contactId === bill.contactId && p.type === 'SUPPLIER'
      );

      // Calculate expected payment date
      const expectedPaymentDate = pattern
        ? addDays(bill.dueDate, pattern.averageDaysToPay)
        : bill.dueDate;

      // Check if payment is expected on this date
      if (format(expectedPaymentDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
        totalOutflow += bill.amountDue;
      }
    }

    return totalOutflow;
  }

  private calculateRepeatingFlows(date: Date, repeatingTransactions: any[]): number {
    let total = 0;

    for (const transaction of repeatingTransactions) {
      if (!transaction.nextScheduledDate) continue;

      // Check if scheduled for this date
      if (format(transaction.nextScheduledDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
        total += transaction.amount;
      }
    }

    return total;
  }

  private calculateTaxPayments(date: Date, taxObligations: any[]): number {
    return taxObligations
      .filter(tax => format(tax.dueDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))
      .reduce((sum, tax) => sum + tax.amount, 0);
  }

  private async calculatePatternBasedOutflows(date: Date): Promise<number> {
    // This would analyze historical patterns for recurring expenses
    // that aren't captured in repeating transactions
    // For MVP, return 0
    return 0;
  }

  private calculateBudgetedOutflows(
    date: Date,
    budgets: any[],
    actualInflows: number,
    actualOutflows: number
  ): number {
    const monthYear = format(date, 'yyyy-MM');
    const dayOfMonth = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    
    // Get budgets for this month
    const monthBudgets = budgets.filter(b => b.monthYear === monthYear);
    
    // Calculate daily budget allocation
    let budgetedOutflow = 0;
    
    for (const budget of monthBudgets) {
      if (budget.category === 'EXPENSE') {
        // Allocate budget evenly across the month
        const dailyBudget = budget.budgetedAmount / daysInMonth;
        
        // Subtract actual outflows already accounted for
        const remainingBudget = Math.max(0, dailyBudget - actualOutflows);
        
        budgetedOutflow += remainingBudget * this.confidenceLevels.budgeted;
      }
    }

    return budgetedOutflow;
  }

  private calculateScenarios(
    openingBalance: number,
    inflows: number,
    outflows: number
  ): { bestCase: number; worstCase: number } {
    // Best case: 20% more inflows, 10% less outflows
    const bestCase = openingBalance + (inflows * 1.2) - (outflows * 0.9);
    
    // Worst case: 20% less inflows, 10% more outflows
    const worstCase = openingBalance + (inflows * 0.8) - (outflows * 1.1);
    
    return { bestCase, worstCase };
  }

  private generateAlerts(
    date: Date,
    balance: number,
    totalOutflows: number,
    taxOutflows: number,
    openInvoices: any[]
  ): Alert[] {
    const alerts: Alert[] = [];

    // Low balance alert
    if (balance < 5000) {
      alerts.push({
        type: 'LOW_BALANCE',
        severity: balance < 1000 ? 'critical' : 'warning',
        message: `Cash balance projected to be ${balance < 0 ? 'negative' : 'low'} at £${balance.toFixed(2)}`,
        amount: balance,
      });
    }

    // Large payment alert
    if (totalOutflows > 10000) {
      alerts.push({
        type: 'LARGE_PAYMENT',
        severity: 'info',
        message: `Large payments totaling £${totalOutflows.toFixed(2)} scheduled`,
        amount: totalOutflows,
      });
    }

    // Tax payment alert
    if (taxOutflows > 0) {
      alerts.push({
        type: 'TAX_DUE',
        severity: 'warning',
        message: `Tax payment of £${taxOutflows.toFixed(2)} due`,
        amount: taxOutflows,
      });
    }

    // Overdue invoice alert (check on current date only)
    if (differenceInDays(date, new Date()) === 0) {
      const overdueInvoices = openInvoices.filter(
        inv => differenceInDays(new Date(), inv.dueDate) > 30
      );
      
      if (overdueInvoices.length > 0) {
        const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amountDue, 0);
        alerts.push({
          type: 'OVERDUE_INVOICE',
          severity: 'warning',
          message: `${overdueInvoices.length} invoices overdue totaling £${overdueAmount.toFixed(2)}`,
          amount: overdueAmount,
        });
      }
    }

    return alerts;
  }

  private calculateConfidenceLevel(
    invoiceInflows: number,
    repeatingInflows: number,
    billOutflows: number,
    repeatingOutflows: number,
    patternOutflows: number,
    budgetOutflows: number
  ): number {
    const total = invoiceInflows + repeatingInflows + billOutflows + 
                 repeatingOutflows + patternOutflows + budgetOutflows;
    
    if (total === 0) return 1.0;

    const weightedConfidence = 
      (invoiceInflows * this.confidenceLevels.confirmedInvoice +
       repeatingInflows * this.confidenceLevels.repeatingInvoice +
       billOutflows * this.confidenceLevels.confirmedInvoice +
       repeatingOutflows * this.confidenceLevels.repeatingInvoice +
       patternOutflows * this.confidenceLevels.inferredPattern +
       budgetOutflows * this.confidenceLevels.budgeted) / total;

    return Math.round(weightedConfidence * 100) / 100;
  }

  private async storeForecast(forecast: DailyForecast): Promise<void> {
    await prisma.cashFlowForecast.upsert({
      where: { date: forecast.date },
      create: {
        date: forecast.date,
        openingBalance: forecast.openingBalance,
        fromInvoices: forecast.inflows.fromInvoices,
        fromRepeating: forecast.inflows.fromRepeating,
        fromOther: forecast.inflows.fromOther,
        totalInflows: forecast.inflows.total,
        toBills: forecast.outflows.toBills,
        toRepeating: forecast.outflows.toRepeating,
        toTaxes: forecast.outflows.toTaxes,
        toPatterns: forecast.outflows.toPatterns,
        toBudgets: forecast.outflows.toBudgets,
        totalOutflows: forecast.outflows.total,
        closingBalance: forecast.closingBalance,
        bestCase: forecast.scenarios.bestCase,
        worstCase: forecast.scenarios.worstCase,
        confidenceLevel: forecast.confidenceLevel,
        alerts: JSON.stringify(forecast.alerts),
      },
      update: {
        openingBalance: forecast.openingBalance,
        fromInvoices: forecast.inflows.fromInvoices,
        fromRepeating: forecast.inflows.fromRepeating,
        fromOther: forecast.inflows.fromOther,
        totalInflows: forecast.inflows.total,
        toBills: forecast.outflows.toBills,
        toRepeating: forecast.outflows.toRepeating,
        toTaxes: forecast.outflows.toTaxes,
        toPatterns: forecast.outflows.toPatterns,
        toBudgets: forecast.outflows.toBudgets,
        totalOutflows: forecast.outflows.total,
        closingBalance: forecast.closingBalance,
        bestCase: forecast.scenarios.bestCase,
        worstCase: forecast.scenarios.worstCase,
        confidenceLevel: forecast.confidenceLevel,
        alerts: JSON.stringify(forecast.alerts),
      },
    });
  }
  
  private async storeForecastBatch(forecasts: DailyForecast[]): Promise<void> {
    // Use transaction for batch insert/update
    await prisma.$transaction(
      forecasts.map(forecast => 
        prisma.cashFlowForecast.upsert({
          where: { date: forecast.date },
          create: {
            date: forecast.date,
            openingBalance: forecast.openingBalance,
            fromInvoices: forecast.inflows.fromInvoices,
            fromRepeating: forecast.inflows.fromRepeating,
            fromOther: forecast.inflows.fromOther,
            totalInflows: forecast.inflows.total,
            toBills: forecast.outflows.toBills,
            toRepeating: forecast.outflows.toRepeating,
            toTaxes: forecast.outflows.toTaxes,
            toPatterns: forecast.outflows.toPatterns,
            toBudgets: forecast.outflows.toBudgets,
            totalOutflows: forecast.outflows.total,
            closingBalance: forecast.closingBalance,
            bestCase: forecast.scenarios.bestCase,
            worstCase: forecast.scenarios.worstCase,
            confidenceLevel: forecast.confidenceLevel,
            alerts: JSON.stringify(forecast.alerts),
          },
          update: {
            openingBalance: forecast.openingBalance,
            fromInvoices: forecast.inflows.fromInvoices,
            fromRepeating: forecast.inflows.fromRepeating,
            fromOther: forecast.inflows.fromOther,
            totalInflows: forecast.inflows.total,
            toBills: forecast.outflows.toBills,
            toRepeating: forecast.outflows.toRepeating,
            toTaxes: forecast.outflows.toTaxes,
            toPatterns: forecast.outflows.toPatterns,
            toBudgets: forecast.outflows.toBudgets,
            totalOutflows: forecast.outflows.total,
            closingBalance: forecast.closingBalance,
            bestCase: forecast.scenarios.bestCase,
            worstCase: forecast.scenarios.worstCase,
            confidenceLevel: forecast.confidenceLevel,
            alerts: JSON.stringify(forecast.alerts),
          },
        })
      )
    );
  }
}
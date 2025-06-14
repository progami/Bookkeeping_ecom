import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CashFlowEngine } from '@/lib/cashflow-engine'
import { prisma } from '@/lib/prisma'
import { addDays, format, startOfDay } from 'date-fns'

// Mock the database
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bankAccount: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    syncedInvoice: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    repeatingTransaction: {
      findMany: vi.fn(),
    },
    paymentPattern: {
      findMany: vi.fn(),
    },
    cashFlowBudget: {
      findMany: vi.fn(),
    },
    taxObligation: {
      findMany: vi.fn(),
    },
    cashFlowForecast: {
      upsert: vi.fn(),
    },
    gLAccount: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    bankTransaction: {
      findMany: vi.fn(),
    },
  },
}))

// Mock the UKTaxCalculator
vi.mock('@/lib/uk-tax-calculator', () => ({
  UKTaxCalculator: vi.fn().mockImplementation(() => ({
    calculateUpcomingTaxes: vi.fn().mockResolvedValue([]),
    storeTaxObligations: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('CashFlowEngine', () => {
  let engine: CashFlowEngine

  beforeEach(() => {
    engine = new CashFlowEngine()
    vi.clearAllMocks()
  })

  describe('getCurrentPosition', () => {
    it('should calculate current cash position correctly', async () => {
      // Mock bank accounts
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
        { id: '2', balance: 5000, status: 'ACTIVE' } as any,
      ])

      // Mock receivables
      vi.mocked(prisma.syncedInvoice.aggregate).mockImplementation(async (args: any) => {
        if (args.where.type === 'ACCREC') {
          return { _sum: { amountDue: 8000 } }
        }
        return { _sum: { amountDue: 3000 } }
      })

      // Mock other required data
      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(1)
      
      expect(forecast[0].openingBalance).toBe(15000) // 10000 + 5000
    })
  })

  describe('generateForecast', () => {
    it('should generate forecast for specified days', async () => {
      // Setup mocks
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 50000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const days = 7
      const forecast = await engine.generateForecast(days)

      expect(forecast).toHaveLength(days)
      expect(forecast[0].openingBalance).toBe(50000)
      expect(forecast[0].date).toBeInstanceOf(Date)
    })

    it('should include open invoices in forecast', async () => {
      const today = startOfDay(new Date())
      const dueDate = addDays(today, 3)

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      // Mock open invoice due in 3 days
      vi.mocked(prisma.syncedInvoice.findMany).mockImplementation(async (args: any) => {
        if (args.where.type === 'ACCREC') {
          return [{
            id: 'inv-1',
            contactId: 'contact-1',
            dueDate,
            amountDue: 5000,
            type: 'ACCREC',
            status: 'OPEN',
          }] as any
        }
        return []
      })

      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(7)

      // Find the forecast for the due date
      const dueDateForecast = forecast.find(f => 
        format(f.date, 'yyyy-MM-dd') === format(dueDate, 'yyyy-MM-dd')
      )

      expect(dueDateForecast?.inflows.fromInvoices).toBe(5000)
    })

    it('should include repeating transactions', async () => {
      const today = startOfDay(new Date())
      const nextScheduled = addDays(today, 5)

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 20000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])

      // Mock repeating transaction
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([{
        id: 'rep-1',
        type: 'ACCPAY',
        nextScheduledDate: nextScheduled,
        amount: 1500,
        status: 'AUTHORISED',
      }] as any)

      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(10)

      const scheduledDateForecast = forecast.find(f => 
        format(f.date, 'yyyy-MM-dd') === format(nextScheduled, 'yyyy-MM-dd')
      )

      expect(scheduledDateForecast?.outflows.toRepeating).toBe(1500)
    })

    it('should calculate scenarios correctly', async () => {
      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockImplementation(async (args: any) => {
        if (args.where.type === 'ACCREC') {
          return [{
            id: 'inv-1',
            dueDate: addDays(new Date(), 1),
            amountDue: 1000,
            type: 'ACCREC',
            status: 'OPEN',
          }] as any
        }
        if (args.where.type === 'ACCPAY') {
          return [{
            id: 'bill-1',
            dueDate: addDays(new Date(), 1),
            amountDue: 500,
            type: 'ACCPAY',
            status: 'OPEN',
          }] as any
        }
        return []
      })

      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(2)

      const day2 = forecast[1]
      
      // Best case: 20% more inflows (1000 * 1.2 = 1200), 10% less outflows (500 * 0.9 = 450)
      // Opening balance: 10000, net: 1200 - 450 = 750, closing: 10750
      expect(day2.scenarios.bestCase).toBe(10750)
      
      // Worst case: 20% less inflows (1000 * 0.8 = 800), 10% more outflows (500 * 1.1 = 550)
      // Opening balance: 10000, net: 800 - 550 = 250, closing: 10250
      expect(day2.scenarios.worstCase).toBe(10250)
    })

    it('should generate alerts for low balance', async () => {
      // Mock setup with low balance
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 2000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(1)

      const lowBalanceAlert = forecast[0].alerts.find(a => a.type === 'LOW_BALANCE')
      expect(lowBalanceAlert).toBeDefined()
      expect(lowBalanceAlert?.severity).toBe('warning')
    })

    it('should generate alerts for tax payments', async () => {
      const today = startOfDay(new Date())

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 50000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      
      // Mock tax obligation
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([{
        id: 'tax-1',
        type: 'VAT',
        dueDate: today,
        amount: 5000,
        status: 'PENDING',
      }] as any)
      
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(1)

      const taxAlert = forecast[0].alerts.find(a => a.type === 'TAX_DUE')
      expect(taxAlert).toBeDefined()
      expect(taxAlert?.amount).toBe(5000)
    })

    it('should use payment patterns for timing', async () => {
      const today = startOfDay(new Date())
      const invoiceDueDate = addDays(today, 5)

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      // Mock invoice with payment pattern
      vi.mocked(prisma.syncedInvoice.findMany).mockImplementation(async (args: any) => {
        if (args.where.type === 'ACCREC') {
          return [{
            id: 'inv-1',
            contactId: 'customer-1',
            dueDate: invoiceDueDate,
            amountDue: 3000,
            type: 'ACCREC',
            status: 'OPEN',
          }] as any
        }
        return []
      })

      // Mock payment pattern - customer typically pays 3 days late
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([{
        id: 'pattern-1',
        contactId: 'customer-1',
        type: 'CUSTOMER',
        averageDaysToPay: 3,
        onTimeRate: 20,
        earlyRate: 10,
        lateRate: 70,
      }] as any)

      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([])
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(10)

      // Payment should be expected 3 days after due date
      const expectedPaymentDate = addDays(invoiceDueDate, 3)
      const paymentDateForecast = forecast.find(f => 
        format(f.date, 'yyyy-MM-dd') === format(expectedPaymentDate, 'yyyy-MM-dd')
      )

      expect(paymentDateForecast?.inflows.fromInvoices).toBe(3000)
    })

    it('should calculate confidence levels correctly', async () => {
      const today = startOfDay(new Date())

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      // Mix of different confidence items
      vi.mocked(prisma.syncedInvoice.findMany).mockImplementation(async (args: any) => {
        if (args.where.type === 'ACCREC') {
          return [{
            id: 'inv-1',
            dueDate: addDays(today, 1),
            amountDue: 1000, // Confidence: 0.95
            type: 'ACCREC',
            status: 'OPEN',
          }] as any
        }
        return []
      })

      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([{
        id: 'rep-1',
        type: 'ACCREC',
        nextScheduledDate: addDays(today, 1),
        amount: 2000, // Confidence: 0.98
        status: 'AUTHORISED',
      }] as any)

      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      
      // Mock budget
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([{
        id: 'budget-1',
        monthYear: format(today, 'yyyy-MM'),
        budgetedAmount: 3000, // Daily portion with confidence: 0.60
        category: 'EXPENSE',
      }] as any)
      
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(2)

      // Day 2 should have mixed confidence
      // Invoice inflow: 1000 * 0.95 = 950
      // Repeating inflow: 2000 * 0.98 = 1960
      // Budget outflow: ~100/day * 0.60 = 60
      // Total weighted: (950 + 1960 + 60) / (1000 + 2000 + 100) = 2970 / 3100 = 0.958
      
      expect(forecast[1].confidenceLevel).toBeGreaterThan(0.9)
      expect(forecast[1].confidenceLevel).toBeLessThan(1.0)
    })
  })

  describe('budget calculations', () => {
    it('should allocate monthly budgets daily', async () => {
      const today = startOfDay(new Date())

      // Mock setup
      vi.mocked(prisma.bankAccount.findMany).mockResolvedValue([
        { id: '1', balance: 10000, status: 'ACTIVE' } as any,
      ])

      vi.mocked(prisma.syncedInvoice.aggregate).mockResolvedValue({
        _sum: { amountDue: 0 },
      })

      vi.mocked(prisma.syncedInvoice.findMany).mockResolvedValue([])
      vi.mocked(prisma.repeatingTransaction.findMany).mockResolvedValue([])
      vi.mocked(prisma.paymentPattern.findMany).mockResolvedValue([])
      
      // Mock monthly budget
      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue([{
        id: 'budget-1',
        monthYear: format(today, 'yyyy-MM'),
        budgetedAmount: 3000, // Should be ~100/day for 30 days
        category: 'EXPENSE',
        accountCode: '400',
      }] as any)
      
      vi.mocked(prisma.taxObligation.findMany).mockResolvedValue([])
      vi.mocked(prisma.cashFlowForecast.upsert).mockResolvedValue({} as any)

      const forecast = await engine.generateForecast(5)

      // Each day should have roughly 1/30th of the budget
      forecast.forEach(day => {
        expect(day.outflows.toBudgets).toBeGreaterThan(50) // At least 50 (half of 100)
        expect(day.outflows.toBudgets).toBeLessThan(150) // At most 150
      })
    })
  })
})
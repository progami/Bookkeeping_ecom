import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withValidation } from '@/lib/validation/middleware'
import { reportQuerySchema } from '@/lib/validation/schemas'
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger'
import { FinancialCalc } from '@/lib/financial-calculations'

export const GET = withValidation(
  { querySchema: reportQuerySchema },
  async (request, { query }) => {
    const startTime = Date.now();
    try {
    // Set cache headers for better performance
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'max-age=600',
    };
    // Get date range from query params or default to last 30 days
    const endDate = query?.date ? new Date(query.date) : new Date()
    const startDate = new Date(endDate)
    const periods = query?.periods || 1
    const timeframe = query?.timeframe || 'MONTH'
    
    // Calculate start date based on timeframe
    switch (timeframe) {
      case 'YEAR':
        startDate.setFullYear(startDate.getFullYear() - periods)
        break
      case 'QUARTER':
        startDate.setMonth(startDate.getMonth() - (periods * 3))
        break
      case 'MONTH':
      default:
        startDate.setMonth(startDate.getMonth() - periods)
        break
    }

    // Fetch transactions from database
    const [revenueTransactions, expenseTransactions, glAccounts] = await Promise.all([
      // Revenue transactions (RECEIVE type)
      prisma.bankTransaction.findMany({
        where: {
          type: 'RECEIVE',
          status: { not: 'DELETED' },
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          accountCode: true
        }
      }),
      
      // Expense transactions (SPEND type)
      prisma.bankTransaction.findMany({
        where: {
          type: 'SPEND',
          status: { not: 'DELETED' },
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          amount: true,
          accountCode: true
        }
      }),

      // Get GL accounts to determine account types
      prisma.gLAccount.findMany({
        where: {
          status: 'ACTIVE'
        },
        select: {
          code: true,
          type: true,
          class: true
        }
      })
    ])

    // Create account code lookup map
    const accountTypes = new Map(
      glAccounts.map(acc => [acc.code, { type: acc.type, class: acc.class }])
    )

    // Calculate P&L values from transactions
    let profitLoss = {
      totalRevenue: 0,
      totalExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
      operatingExpenses: 0,
      costOfGoodsSold: 0,
      revenue: 0,
      expenses: 0,
      revenueChange: 0,
      profitChange: 0
    }

    // Calculate revenue using decimal precision
    revenueTransactions.forEach(tx => {
      const amount = FinancialCalc.toNumber(tx.amount)
      profitLoss.totalRevenue += amount
      profitLoss.revenue += amount
    })

    // Calculate expenses and categorize them
    expenseTransactions.forEach(tx => {
      const accountType = accountTypes.get(tx.accountCode || '')
      const amount = FinancialCalc.toNumber(tx.amount)
      
      // Check if this is cost of goods sold based on account type
      if (accountType && (
        accountType.type === 'DIRECTCOSTS' || 
        accountType.class === 'EXPENSE' && tx.accountCode?.startsWith('5') // Common COGS account codes
      )) {
        profitLoss.costOfGoodsSold += amount
      } else {
        profitLoss.operatingExpenses += amount
      }
      
      profitLoss.totalExpenses += amount
      profitLoss.expenses += amount
    })

    // Calculate gross and net profit
    profitLoss.grossProfit = profitLoss.totalRevenue - profitLoss.costOfGoodsSold
    profitLoss.netProfit = profitLoss.totalRevenue - profitLoss.totalExpenses

    // Calculate period comparison based on timeframe
    const previousEndDate = new Date(startDate)
    const previousStartDate = new Date(startDate)
    
    switch (timeframe) {
      case 'YEAR':
        previousStartDate.setFullYear(previousStartDate.getFullYear() - periods)
        break
      case 'QUARTER':
        previousStartDate.setMonth(previousStartDate.getMonth() - (periods * 3))
        break
      case 'MONTH':
      default:
        previousStartDate.setMonth(previousStartDate.getMonth() - periods)
        break
    }

    const [prevRevenue, prevExpenses] = await Promise.all([
      prisma.bankTransaction.aggregate({
        where: {
          type: 'RECEIVE',
          status: { not: 'DELETED' },
          date: {
            gte: previousStartDate,
            lte: previousEndDate
          }
        },
        _sum: { amount: true }
      }),
      prisma.bankTransaction.aggregate({
        where: {
          type: 'SPEND',
          status: { not: 'DELETED' },
          date: {
            gte: previousStartDate,
            lte: previousEndDate
          }
        },
        _sum: { amount: true }
      })
    ])

    const previousRevenueTotal = FinancialCalc.toNumber(prevRevenue._sum.amount || 0)
    const previousExpenseTotal = FinancialCalc.toNumber(prevExpenses._sum.amount || 0)
    const previousProfit = previousRevenueTotal - previousExpenseTotal

    // Calculate percentage changes
    if (previousRevenueTotal > 0) {
      profitLoss.revenueChange = ((profitLoss.totalRevenue - previousRevenueTotal) / previousRevenueTotal) * 100
    }

    if (previousProfit !== 0) {
      profitLoss.profitChange = ((profitLoss.netProfit - previousProfit) / Math.abs(previousProfit)) * 100
    }

    // Log successful P&L generation
    await auditLogger.logSuccess(
      AuditAction.REPORT_GENERATE,
      AuditResource.PROFIT_LOSS,
      {
        metadata: {
          queryParams: query,
          dateRange: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          duration: Date.now() - startTime
        }
      }
    );

    return NextResponse.json(profitLoss, {
      headers: responseHeaders
    })
  } catch (error) {
    console.error('Profit & Loss error:', error)
    
    // Log failure
    await auditLogger.logFailure(
      AuditAction.REPORT_GENERATE,
      AuditResource.PROFIT_LOSS,
      error as Error,
      {
        metadata: {
          queryParams: query,
          duration: Date.now() - startTime
        }
      }
    );
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profit & loss' },
      { status: 500 }
    )
  }
  }
)
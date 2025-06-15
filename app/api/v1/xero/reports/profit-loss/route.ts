import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Set cache headers for better performance
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'max-age=600',
    };
    // Get date range for last 30 days by default
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 30)

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

    // Calculate revenue
    revenueTransactions.forEach(tx => {
      profitLoss.totalRevenue += tx.amount.toNumber()
      profitLoss.revenue += tx.amount.toNumber()
    })

    // Calculate expenses and categorize them
    expenseTransactions.forEach(tx => {
      const accountType = accountTypes.get(tx.accountCode || '')
      
      // Check if this is cost of goods sold based on account type
      if (accountType && (
        accountType.type === 'DIRECTCOSTS' || 
        accountType.class === 'EXPENSE' && tx.accountCode?.startsWith('5') // Common COGS account codes
      )) {
        profitLoss.costOfGoodsSold += tx.amount.toNumber()
      } else {
        profitLoss.operatingExpenses += tx.amount.toNumber()
      }
      
      profitLoss.totalExpenses += tx.amount.toNumber()
      profitLoss.expenses += tx.amount.toNumber()
    })

    // Calculate gross and net profit
    profitLoss.grossProfit = profitLoss.totalRevenue - profitLoss.costOfGoodsSold
    profitLoss.netProfit = profitLoss.totalRevenue - profitLoss.totalExpenses

    // Calculate period comparison (compare to previous 30 days)
    const previousEndDate = new Date(startDate)
    const previousStartDate = new Date(startDate)
    previousStartDate.setDate(previousStartDate.getDate() - 30)

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

    const previousRevenueTotal = prevRevenue._sum.amount?.toNumber() || 0
    const previousExpenseTotal = prevExpenses._sum.amount?.toNumber() || 0
    const previousProfit = previousRevenueTotal - previousExpenseTotal

    // Calculate percentage changes
    if (previousRevenueTotal > 0) {
      profitLoss.revenueChange = ((profitLoss.totalRevenue - previousRevenueTotal) / previousRevenueTotal) * 100
    }

    if (previousProfit !== 0) {
      profitLoss.profitChange = ((profitLoss.netProfit - previousProfit) / Math.abs(previousProfit)) * 100
    }

    return NextResponse.json(profitLoss, {
      headers: responseHeaders
    })
  } catch (error) {
    console.error('Profit & Loss error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profit & loss' },
      { status: 500 }
    )
  }
}
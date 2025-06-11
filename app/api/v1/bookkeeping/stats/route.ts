import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get rule counts
    const [totalRules, activeRules, recentTransactions] = await Promise.all([
      prisma.categorizationRule.count(),
      prisma.categorizationRule.count({ where: { isActive: true } }),
      prisma.bankTransaction.findMany({
        take: 10,
        orderBy: { date: 'desc' },
        include: {
          bankAccount: {
            select: {
              name: true
            }
          }
        }
      })
    ])

    const inactiveRules = totalRules - activeRules

    // Get recent activity (last 10 rule changes)
    const recentRules = await prisma.categorizationRule.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Transform to activity format
    const recentActivity = recentRules.map(rule => ({
      id: rule.id,
      type: rule.createdAt.getTime() === rule.updatedAt.getTime() ? 'rule_created' : 'rule_updated',
      ruleName: rule.name,
      timestamp: rule.updatedAt.toISOString()
    }))

    // Calculate match rate based on actual rule performance
    const matchRate = 0 // Will be calculated when rules are actually applied to transactions

    return NextResponse.json({
      totalRules,
      activeRules,
      inactiveRules,
      matchRate,
      recentActivity,
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        description: tx.description || 'No description',
        amount: tx.amount,
        type: tx.type,
        status: tx.isReconciled ? 'reconciled' : 'unreconciled',
        bankAccount: tx.bankAccount?.name || 'Unknown'
      }))
    })
  } catch (error) {
    console.error('Error fetching bookkeeping stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookkeeping statistics' },
      { status: 500 }
    )
  }
}
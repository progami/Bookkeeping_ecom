import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get rule counts
    const [totalRules, activeRules] = await Promise.all([
      prisma.categorizationRule.count(),
      prisma.categorizationRule.count({ where: { isActive: true } })
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

    // Mock system status for now
    const systemStatus = {
      xeroConnected: false, // Will be implemented when Xero OAuth is added
      lastSync: null,
      automationEnabled: false
    }

    return NextResponse.json({
      totalRules,
      activeRules,
      inactiveRules,
      recentActivity,
      systemStatus
    })
  } catch (error) {
    console.error('Error fetching bookkeeping stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bookkeeping statistics' },
      { status: 500 }
    )
  }
}
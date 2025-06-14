import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Get reconciliation stats
    const [recentTransactions, unreconciledCount] = await Promise.all([
      prisma.bankTransaction.findMany({
        orderBy: { date: 'desc' },
        take: 10, // Limit to 10 most recent
        include: {
          bankAccount: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.bankTransaction.count({ 
        where: { 
          isReconciled: false,
          status: { not: 'DELETED' }
        } 
      })
    ])

    return NextResponse.json({
      unreconciledCount,
      reconciliationRate: recentTransactions.length > 0 
        ? Math.round((recentTransactions.filter(tx => tx.isReconciled).length / recentTransactions.length) * 100)
        : 0,
      recentTransactions: recentTransactions.map(tx => ({
        id: tx.id,
        date: tx.date,
        description: tx.description || 'No description',
        amount: tx.amount,
        type: tx.type,
        status: tx.isReconciled ? 'reconciled' : 'unreconciled',
        bankAccount: tx.bankAccount?.name || 'Unknown',
        contactName: tx.contactName || null,
        reference: tx.reference || null
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
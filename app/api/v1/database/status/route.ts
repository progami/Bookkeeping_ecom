import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Check if we have any data in key tables
    const [
      bankAccountCount,
      transactionCount,
      glAccountCount,
      lastSyncRecord
    ] = await Promise.all([
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.gLAccount.count(),
      prisma.syncLog.findFirst({
        where: { 
          status: 'SUCCESS',
          syncType: 'full_sync'
        },
        orderBy: { completedAt: 'desc' }
      })
    ])

    const hasData = bankAccountCount > 0 || transactionCount > 0 || glAccountCount > 0
    
    return NextResponse.json({
      hasData,
      counts: {
        bankAccounts: bankAccountCount,
        transactions: transactionCount,
        glAccounts: glAccountCount
      },
      lastSync: lastSyncRecord?.completedAt || null,
      lastSyncSummary: lastSyncRecord ? {
        recordsCreated: lastSyncRecord.recordsCreated,
        recordsUpdated: lastSyncRecord.recordsUpdated,
        duration: lastSyncRecord.completedAt && lastSyncRecord.startedAt
          ? new Date(lastSyncRecord.completedAt).getTime() - new Date(lastSyncRecord.startedAt).getTime()
          : null
      } : null
    })
  } catch (error: any) {
    console.error('Database status error:', error)
    return NextResponse.json(
      { error: 'Failed to check database status' },
      { status: 500 }
    )
  }
}
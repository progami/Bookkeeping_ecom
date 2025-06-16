import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'
import { syncXeroData } from '@/lib/xero-sync'
import { structuredLogger } from '@/lib/logger'

const importSchema = z.object({
  dateRange: z.enum(['last_3_months', 'last_6_months', 'last_12_months', 'all']),
  entities: z.array(z.string()),
  categories: z.enum(['auto_map', 'manual_map'])
})

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request, ValidationLevel.USER)
    
    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const options = importSchema.parse(body)

    // Calculate date range
    const now = new Date()
    let fromDate: Date | undefined
    
    switch (options.dateRange) {
      case 'last_3_months':
        fromDate = new Date(now.setMonth(now.getMonth() - 3))
        break
      case 'last_6_months':
        fromDate = new Date(now.setMonth(now.getMonth() - 6))
        break
      case 'last_12_months':
        fromDate = new Date(now.setMonth(now.getMonth() - 12))
        break
      case 'all':
        fromDate = undefined
        break
    }

    structuredLogger.info('Starting setup import', {
      component: 'setup-import',
      tenantId: session.user.tenantId,
      dateRange: options.dateRange,
      entities: options.entities
    })

    // Trigger the sync with options
    const result = await syncXeroData(
      session.user.tenantId, 
      session.user.userId,
      {
        syncType: 'full_sync',
        fromDate,
        entities: options.entities
      }
    )

    if (!result.success) {
      throw new Error(result.error || 'Sync failed')
    }

    return NextResponse.json({
      success: true,
      message: 'Import started successfully',
      syncLogId: result.syncLogId,
      recordsProcessed: result.recordsCreated
    })
  } catch (error: any) {
    structuredLogger.error('Setup import failed', error, {
      component: 'setup-import'
    })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid import options', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}
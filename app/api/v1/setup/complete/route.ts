import { NextRequest, NextResponse } from 'next/server'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'
import { prisma } from '@/lib/prisma'
import { structuredLogger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession(request, ValidationLevel.USER)
    
    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Mark setup as complete
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        hasCompletedSetup: true,
        setupCompletedAt: new Date()
      }
    })

    structuredLogger.info('User completed setup', {
      component: 'setup-complete',
      userId: session.user.userId,
      email: session.user.email
    })

    return NextResponse.json({
      success: true,
      message: 'Setup marked as complete'
    })
  } catch (error: any) {
    structuredLogger.error('Failed to complete setup', error, {
      component: 'setup-complete'
    })
    
    return NextResponse.json(
      { error: 'Failed to complete setup' },
      { status: 500 }
    )
  }
}
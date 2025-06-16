import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation'
import { prisma } from '@/lib/prisma'

const configureSchema = z.object({
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
    const options = configureSchema.parse(body)

    // Store import configuration in user preferences
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        importPreferences: JSON.stringify(options)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Import configuration saved'
    })
  } catch (error: any) {
    console.error('Configure error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Configuration failed' },
      { status: 500 }
    )
  }
}
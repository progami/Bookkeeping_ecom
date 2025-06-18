import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from '@/lib/cookie-config'
import { withErrorHandling, ApiErrors, successResponse } from '@/lib/errors/api-error-wrapper'
import { structuredLogger } from '@/lib/logger'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional()
})

export const POST = withErrorHandling(
  async (request: NextRequest) => {
    const body = await request.json()
    const { email, password, name } = registerSchema.parse(body)

    structuredLogger.info('Registration attempt', {
      component: 'auth-register',
      email
    })

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      throw ApiErrors.alreadyExists('Email')
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        hasCompletedSetup: false
      }
    })

    // Create session data
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId || '',
      tenantName: user.tenantName || user.name || 'User'
    }

    structuredLogger.info('Registration successful', {
      component: 'auth-register',
      userId: user.id,
      email: user.email
    })

    // Create response with user data
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasCompletedSetup: false
      }
    })

    // Set session cookie with proper configuration
    response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), AUTH_COOKIE_OPTIONS)

    return response
  },
  { endpoint: '/api/v1/auth/register' }
)
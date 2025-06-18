import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from '@/lib/cookie-config'
import { withErrorHandling, ApiErrors, successResponse } from '@/lib/errors/api-error-wrapper'
import { structuredLogger } from '@/lib/logger'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

export const POST = withErrorHandling(
  async (request: NextRequest) => {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    structuredLogger.info('Login attempt', {
      component: 'auth-login',
      email
    })

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      throw ApiErrors.invalidCredentials()
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      throw ApiErrors.invalidCredentials()
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
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

    structuredLogger.info('Login successful', {
      component: 'auth-login',
      userId: user.id,
      email: user.email
    })

    // Create response with user data
    const response = successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        hasCompletedSetup: user.hasCompletedSetup
      }
    })

    // Set session cookie with proper configuration
    response.cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), AUTH_COOKIE_OPTIONS)

    return response
  },
  { endpoint: '/api/v1/auth/login' }
)
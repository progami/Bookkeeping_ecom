import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema } from 'zod';
import { withValidation } from '@/lib/validation/middleware';
import { validateSession, ValidationLevel, ValidatedSession } from './session-validation';
import { structuredLogger } from '@/lib/logger';
import { Logger } from '@/lib/logger';
import crypto from 'crypto';

export interface AuthenticatedContext<TBody = any, TQuery = any> {
  body?: TBody;
  query?: TQuery;
  params?: any;
  session: ValidatedSession;
  logger: Logger;
}

/**
 * Combines validation and authentication for API routes
 */
export function withAuthValidation<TBody = any, TQuery = any>(
  options: {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
    authLevel?: ValidationLevel;
  },
  handler: (
    request: NextRequest,
    context: AuthenticatedContext<TBody, TQuery>
  ) => Promise<NextResponse>
) {
  // First apply validation
  const validatedHandler = withValidation(
    {
      bodySchema: options.bodySchema,
      querySchema: options.querySchema
    },
    async (request, validationContext) => {
      // Then apply authentication
      const session = await validateSession(
        request,
        options.authLevel || ValidationLevel.USER
      );

      if (!session.isValid) {
        structuredLogger.warn('Authentication failed', {
          component: 'auth-wrapper',
          endpoint: request.nextUrl.pathname,
          authLevel: options.authLevel
        });

        return NextResponse.json(
          {
            error: 'Unauthorized',
            message: 'Invalid or expired session',
            code: 'AUTH_REQUIRED'
          },
          { status: 401 }
        );
      }

      // Create request-scoped logger
      const requestId = crypto.randomUUID();
      const requestLogger = structuredLogger.child({
        requestId,
        userId: session.user?.userId,
        email: session.user?.email,
      });

      // Combine contexts
      const context: AuthenticatedContext<TBody, TQuery> = {
        ...validationContext,
        session,
        logger: requestLogger
      };

      // Call the handler with authenticated context
      try {
        return await handler(request, context);
      } catch (error) {
        structuredLogger.error('Handler error after auth validation', error, {
          component: 'auth-wrapper',
          endpoint: request.nextUrl.pathname,
          userId: session.user?.userId
        });

        return NextResponse.json(
          {
            error: 'Internal server error',
            message: 'An unexpected error occurred'
          },
          { status: 500 }
        );
      }
    }
  );

  return validatedHandler;
}

/**
 * Simple auth wrapper without validation
 */
export function withAuth(
  authLevel: ValidationLevel = ValidationLevel.USER,
  handler: (
    request: NextRequest,
    session: ValidatedSession
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, props?: { params?: any }): Promise<NextResponse> => {
    const session = await validateSession(request, authLevel);

    if (!session.isValid) {
      structuredLogger.warn('Authentication failed', {
        component: 'auth-wrapper',
        endpoint: request.nextUrl.pathname,
        authLevel
      });

      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }

    try {
      return await handler(request, session);
    } catch (error) {
      structuredLogger.error('Handler error after auth', error, {
        component: 'auth-wrapper',
        endpoint: request.nextUrl.pathname,
        userId: session.user?.userId
      });

      return NextResponse.json(
        {
          error: 'Internal server error',
          message: 'An unexpected error occurred'
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Rate limiting wrapper with authentication
 */
export function withAuthRateLimit(
  options: {
    authLevel?: ValidationLevel;
    maxRequests?: number;
    windowMs?: number;
  },
  handler: (
    request: NextRequest,
    session: ValidatedSession
  ) => Promise<NextResponse>
) {
  // Simple in-memory rate limiting (use Redis in production)
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return withAuth(options.authLevel, async (request, session) => {
    const userId = session.user.userId;
    const now = Date.now();
    const windowMs = options.windowMs || 60000; // 1 minute default
    const maxRequests = options.maxRequests || 60; // 60 requests per minute default
    
    // Get or create rate limit entry
    let userLimit = requestCounts.get(userId);
    if (!userLimit || now > userLimit.resetTime) {
      userLimit = {
        count: 0,
        resetTime: now + windowMs
      };
      requestCounts.set(userId, userLimit);
    }
    
    // Check rate limit
    if (userLimit.count >= maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      
      structuredLogger.warn('Rate limit exceeded', {
        component: 'auth-wrapper',
        endpoint: request.nextUrl.pathname,
        userId,
        count: userLimit.count,
        limit: maxRequests
      });
      
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(userLimit.resetTime / 1000))
          }
        }
      );
    }
    
    // Increment count
    userLimit.count++;
    
    // Add rate limit headers to response
    const response = await handler(request, session);
    response.headers.set('X-RateLimit-Limit', String(maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(maxRequests - userLimit.count));
    response.headers.set('X-RateLimit-Reset', String(Math.floor(userLimit.resetTime / 1000)));
    
    return response;
  });
}

/**
 * Admin-only endpoint wrapper
 */
export function withAdminAuth(
  handler: (
    request: NextRequest,
    session: ValidatedSession
  ) => Promise<NextResponse>
) {
  return withAuth(ValidationLevel.ADMIN, handler);
}

/**
 * Xero API endpoint wrapper
 */
export function withXeroAuth(
  handler: (
    request: NextRequest,
    session: ValidatedSession
  ) => Promise<NextResponse>
) {
  return withAuth(ValidationLevel.XERO, handler);
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, TOKEN_COOKIE_NAME } from '@/lib/cookie-config';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

export interface SessionUser {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  role?: string;
}

export interface XeroTokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
}

export interface ValidatedSession {
  user: SessionUser;
  xeroToken?: XeroTokenData;
  isAdmin: boolean;
  isValid: boolean;
}

/**
 * Session validation levels
 */
export enum ValidationLevel {
  NONE = 'none',           // No validation required
  USER = 'user',           // User session required
  XERO = 'xero',           // Xero token required
  ADMIN = 'admin'          // Admin privileges required
}

/**
 * Validates a session token
 */
function validateSessionToken(token: string): SessionUser | null {
  try {
    // For now, parse the session data directly (migrate to JWT in production)
    const sessionData = JSON.parse(token);
    
    // Check for userId field (expected format)
    if (sessionData.userId && sessionData.email) {
      return sessionData as SessionUser;
    }
    
    // Also check for legacy format with nested user object
    if (sessionData.user && sessionData.user.id && sessionData.email) {
      return {
        userId: sessionData.user.id,
        email: sessionData.email,
        tenantId: sessionData.tenantId || '',
        tenantName: sessionData.tenantName || '',
        role: sessionData.role || 'user'
      };
    }
  } catch (error) {
    structuredLogger.warn('Failed to parse session token', {
      component: 'session-validation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
  return null;
}

/**
 * Validates session and returns user information
 */
export async function validateSession(
  request: NextRequest,
  level: ValidationLevel = ValidationLevel.USER
): Promise<ValidatedSession> {
  try {
    // No validation needed for public endpoints
    if (level === ValidationLevel.PUBLIC || level === ValidationLevel.NONE) {
      return {
        user: {
          userId: 'anonymous',
          email: 'anonymous@example.com',
          tenantId: '',
          tenantName: 'Anonymous'
        },
        isAdmin: false,
        isValid: true
      };
    }

    const cookieStore = cookies();
    
    // Check for user session
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) {
      return {
        user: null as any,
        isAdmin: false,
        isValid: false
      };
    }

    // Validate session token
    const sessionData = validateSessionToken(sessionCookie.value);
    if (!sessionData) {
      structuredLogger.warn('Invalid session token', {
        component: 'session-validation'
      });
      return {
        user: null as any,
        isAdmin: false,
        isValid: false
      };
    }

    // Verify user exists in database
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionData.userId }
    });

    if (!dbUser) {
      structuredLogger.warn('User not found in database', {
        component: 'session-validation',
        userId: sessionData.userId
      });
      return {
        user: null as any,
        isAdmin: false,
        isValid: false
      };
    }

    // Update session data with fresh database info
    const user: SessionUser = {
      userId: dbUser.id,
      email: dbUser.email,
      tenantId: sessionData.tenantId,
      tenantName: sessionData.tenantName,
      role: 'user' // Default role since User model doesn't have role field
    };

    // Check admin privileges if required - for now, only check email
    const isAdmin = dbUser.email === 'ajarrar@trademanenterprise.com';
    if (level === ValidationLevel.ADMIN && !isAdmin) {
      structuredLogger.warn('Non-admin user attempted admin access', {
        component: 'session-validation',
        userId: user.userId,
        endpoint: request.nextUrl.pathname
      });
      return {
        user,
        isAdmin: false,
        isValid: false
      };
    }

    // Validate Xero token if required
    let xeroToken: XeroTokenData | undefined;
    if (level === ValidationLevel.XERO) {
      const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);
      if (!tokenCookie?.value) {
        structuredLogger.warn('Xero token missing', {
          component: 'session-validation',
          userId: user.userId
        });
        return {
          user,
          isAdmin,
          isValid: false
        };
      }

      try {
        xeroToken = JSON.parse(tokenCookie.value);
        
        // Check token expiration
        const now = Date.now();
        const expiresAt = xeroToken!.expires_at * 1000; // Convert to milliseconds
        const bufferTime = 5 * 60 * 1000; // 5 minute buffer
        
        if (now >= expiresAt - bufferTime) {
          structuredLogger.warn('Xero token expired or expiring soon', {
            component: 'session-validation',
            userId: user.userId,
            expiresAt: new Date(expiresAt).toISOString()
          });
          
          // Token needs refresh
          return {
            user,
            xeroToken,
            isAdmin,
            isValid: false
          };
        }
        
        // Skip Xero client verification here to avoid circular dependency
        // The actual API routes will handle client initialization
        structuredLogger.debug('Xero token validated', {
          component: 'session-validation',
          userId: user.userId,
          tokenExpiry: new Date(expiresAt).toISOString()
        });
      } catch (error) {
        structuredLogger.error('Error validating Xero token', error, {
          component: 'session-validation',
          userId: user.userId
        });
        return {
          user,
          isAdmin,
          isValid: false
        };
      }
    }

    // Log successful validation only in debug mode
    if (process.env.LOG_LEVEL === 'debug') {
      structuredLogger.info('Session validated successfully', {
        component: 'session-validation',
        userId: user.userId,
        level,
        isAdmin
      });
    }

    return {
      user,
      xeroToken,
      isAdmin,
      isValid: true
    };
  } catch (error) {
    structuredLogger.error('Session validation error', error, {
      component: 'session-validation',
      endpoint: request.nextUrl.pathname
    });
    
    return {
      user: null as any,
      isAdmin: false,
      isValid: false
    };
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(level: ValidationLevel = ValidationLevel.USER) {
  return async (
    request: NextRequest,
    handler: (request: NextRequest, session: ValidatedSession) => Promise<NextResponse>
  ): Promise<NextResponse> => {
    const session = await validateSession(request, level);
    
    if (!session.isValid) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }
    
    // Add session to request headers for downstream use
    const modifiedRequest = new NextRequest(request.url, {
      headers: new Headers(request.headers)
    });
    modifiedRequest.headers.set('X-User-Id', session.user.userId);
    modifiedRequest.headers.set('X-User-Email', session.user.email);
    modifiedRequest.headers.set('X-Tenant-Id', session.user.tenantId);
    modifiedRequest.headers.set('X-Is-Admin', String(session.isAdmin));
    
    return handler(modifiedRequest, session);
  };
}

/**
 * Wrapper for API routes that require authentication
 */
export function withAuth<T extends (...args: any[]) => any>(
  handler: T,
  level: ValidationLevel = ValidationLevel.USER
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const session = await validateSession(request, level);
    
    if (!session.isValid) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Invalid or expired session',
          code: 'AUTH_REQUIRED'
        },
        { status: 401 }
      );
    }
    
    // Inject session into request
    (request as any).session = session;
    
    return handler(request, ...args);
  }) as T;
}

/**
 * Creates a new session
 */
export async function createSession(user: SessionUser): Promise<string> {
  // In production, use proper JWT signing
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  
  try {
    // For now, just stringify the session data
    // TODO: Implement proper JWT signing
    return JSON.stringify(user);
  } catch (error) {
    structuredLogger.error('Error creating session', error, {
      component: 'session-validation',
      userId: user.userId
    });
    throw error;
  }
}

/**
 * Refreshes a session
 */
export async function refreshSession(userId: string): Promise<SessionUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return null;
    }
    
    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId || '',
      tenantName: user.tenantName || '',
      role: 'user' // Default role
    };
  } catch (error) {
    structuredLogger.error('Error refreshing session', error, {
      component: 'session-validation',
      userId
    });
    return null;
  }
}
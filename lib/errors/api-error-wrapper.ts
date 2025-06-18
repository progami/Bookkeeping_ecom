import { withErrorHandling, createError, AppError } from './error-handler';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';

/**
 * Standard API response wrapper that combines auth validation and error handling
 * 
 * Usage:
 * export const GET = apiWrapper(
 *   async (request, { session }) => {
 *     // Your handler code here
 *     return NextResponse.json({ data: 'success' });
 *   },
 *   {
 *     authLevel: ValidationLevel.FULL,
 *     endpoint: '/api/v1/example'
 *   }
 * );
 */

interface ApiWrapperOptions {
  authLevel?: ValidationLevel;
  endpoint: string;
  requireXero?: boolean;
  bodySchema?: any;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

type ApiHandler<T = any> = (
  request: NextRequest,
  context: {
    session?: any;
    body?: T;
    params?: any;
  }
) => Promise<NextResponse>;

export function apiWrapper<T = any>(
  handler: ApiHandler<T>,
  options: ApiWrapperOptions
) {
  // If auth is required, wrap with auth validation first
  if (options.authLevel !== undefined) {
    const authOptions: any = {
      authLevel: options.authLevel,
      requireXero: options.requireXero,
      bodySchema: options.bodySchema
    };

    return withErrorHandling(
      withAuthValidation(authOptions, handler),
      { endpoint: options.endpoint }
    );
  }

  // Otherwise just wrap with error handling
  return withErrorHandling(handler, { endpoint: options.endpoint });
}

/**
 * Common error responses for consistency
 */
export const ApiErrors = {
  // Authentication errors
  unauthorized: () => createError.authentication('Authentication required'),
  invalidCredentials: () => createError.authentication('Invalid credentials'),
  sessionExpired: () => createError.authentication('Session expired'),
  
  // Authorization errors
  forbidden: () => createError.authorization('Access denied'),
  insufficientPermissions: () => createError.authorization('Insufficient permissions'),
  xeroRequired: () => createError.authorization('Xero connection required'),
  
  // Validation errors
  invalidRequest: (details?: any) => createError.validation('Invalid request', details),
  missingParameter: (param: string) => createError.validation(`Missing required parameter: ${param}`),
  invalidParameter: (param: string, reason?: string) => 
    createError.validation(`Invalid parameter: ${param}${reason ? ` - ${reason}` : ''}`),
  
  // Resource errors
  notFound: (resource: string) => createError.notFound(resource),
  alreadyExists: (resource: string) => createError.conflict(`${resource} already exists`),
  
  // External service errors
  xeroError: (message: string) => createError.externalService('Xero', message),
  xeroNotConnected: () => createError.externalService('Xero', 'Not connected to Xero'),
  xeroRateLimit: () => createError.rateLimit(),
  
  // Database errors
  databaseError: (operation: string) => createError.database(operation),
  
  // Generic errors
  internalError: (message?: string) => createError.internal(message || 'An unexpected error occurred')
};

/**
 * Standard success response helper
 */
export function successResponse<T>(
  data: T,
  options?: {
    message?: string;
    meta?: Record<string, any>;
    status?: number;
  }
) {
  const response: any = {
    success: true,
    data
  };

  if (options?.message) {
    response.message = options.message;
  }

  if (options?.meta) {
    response.meta = options.meta;
  }

  return NextResponse.json(response, { status: options?.status || 200 });
}

/**
 * Standard paginated response helper
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  },
  options?: {
    message?: string;
    meta?: Record<string, any>;
  }
) {
  return successResponse(data, {
    ...options,
    meta: {
      ...options?.meta,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.pageSize),
        hasMore: pagination.page * pagination.pageSize < pagination.total
      }
    }
  });
}

/**
 * Helper to log and throw API errors
 */
export function throwApiError(
  error: AppError,
  context?: Record<string, any>
): never {
  structuredLogger.error('API Error', error, {
    component: 'api-error-wrapper',
    ...context
  });
  throw error;
}

/**
 * Parse request body safely with error handling
 */
export async function parseRequestBody<T = any>(
  request: NextRequest,
  schema?: any
): Promise<T> {
  try {
    const body = await request.json();
    
    if (schema) {
      const result = schema.safeParse(body);
      if (!result.success) {
        throw ApiErrors.invalidRequest(result.error.errors);
      }
      return result.data;
    }
    
    return body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw ApiErrors.invalidRequest('Invalid JSON body');
  }
}

/**
 * Extract and validate query parameters
 */
export function getQueryParams(
  request: NextRequest,
  schema?: any
): Record<string, any> {
  const { searchParams } = new URL(request.url);
  const params: Record<string, any> = {};
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  if (schema) {
    const result = schema.safeParse(params);
    if (!result.success) {
      throw ApiErrors.invalidRequest(result.error.errors);
    }
    return result.data;
  }
  
  return params;
}

/**
 * Standard response headers
 */
export const API_HEADERS = {
  json: { 'Content-Type': 'application/json' },
  cache: {
    none: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    short: { 'Cache-Control': 'public, max-age=60' }, // 1 minute
    medium: { 'Cache-Control': 'public, max-age=300' }, // 5 minutes
    long: { 'Cache-Control': 'public, max-age=3600' }, // 1 hour
  },
  cors: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
};

/**
 * Export everything from error-handler for convenience
 */
export * from './error-handler';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { structuredLogger } from '@/lib/logger';

/**
 * Standard error types for the application
 */
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST'
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    type: ErrorType,
    message: string,
    statusCode: number,
    code?: string,
    details?: any,
    isOperational = true
  ) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error type to HTTP status code mapping
 */
const ERROR_STATUS_MAP: Record<ErrorType, number> = {
  [ErrorType.VALIDATION]: 400,
  [ErrorType.AUTHENTICATION]: 401,
  [ErrorType.AUTHORIZATION]: 403,
  [ErrorType.NOT_FOUND]: 404,
  [ErrorType.CONFLICT]: 409,
  [ErrorType.RATE_LIMIT]: 429,
  [ErrorType.EXTERNAL_SERVICE]: 502,
  [ErrorType.DATABASE]: 500,
  [ErrorType.INTERNAL]: 500,
  [ErrorType.BAD_REQUEST]: 400
};

/**
 * Handles errors and returns standardized error response
 */
export function handleError(
  error: unknown,
  context?: {
    endpoint?: string;
    userId?: string;
    requestId?: string;
  }
): NextResponse {
  // Handle known application errors
  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        type: error.type,
        message: error.message,
        code: error.code,
        details: error.isOperational ? error.details : undefined,
        timestamp: new Date().toISOString(),
        requestId: context?.requestId
      }
    };

    structuredLogger.error('Application error', error, {
      component: 'error-handler',
      errorType: error.type,
      statusCode: error.statusCode,
      ...context
    });

    return NextResponse.json(errorResponse, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const errorResponse: ErrorResponse = {
      error: {
        type: ErrorType.VALIDATION,
        message: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        })),
        timestamp: new Date().toISOString(),
        requestId: context?.requestId
      }
    };

    structuredLogger.warn('Validation error', {
      component: 'error-handler',
      errors: error.errors,
      ...context
    });

    return NextResponse.json(errorResponse, { status: 400 });
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    
    // Handle unique constraint violations
    if (prismaError.code === 'P2002') {
      const errorResponse: ErrorResponse = {
        error: {
          type: ErrorType.CONFLICT,
          message: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE',
          details: process.env.NODE_ENV === 'development' ? prismaError.meta : undefined,
          timestamp: new Date().toISOString(),
          requestId: context?.requestId
        }
      };

      structuredLogger.warn('Database constraint violation', {
        component: 'error-handler',
        code: prismaError.code,
        ...context
      });

      return NextResponse.json(errorResponse, { status: 409 });
    }

    // Handle record not found
    if (prismaError.code === 'P2025') {
      const errorResponse: ErrorResponse = {
        error: {
          type: ErrorType.NOT_FOUND,
          message: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: context?.requestId
        }
      };

      structuredLogger.warn('Database record not found', {
        component: 'error-handler',
        code: prismaError.code,
        ...context
      });

      return NextResponse.json(errorResponse, { status: 404 });
    }
  }

  // Handle Xero API errors
  if (error && typeof error === 'object' && 'response' in error) {
    const xeroError = error as any;
    const statusCode = xeroError.response?.statusCode || 502;
    const errorType = statusCode === 429 ? ErrorType.RATE_LIMIT : ErrorType.EXTERNAL_SERVICE;

    const errorResponse: ErrorResponse = {
      error: {
        type: errorType,
        message: 'External service error',
        code: 'XERO_API_ERROR',
        details: process.env.NODE_ENV === 'development' ? {
          statusCode,
          message: xeroError.message,
          body: xeroError.response?.body
        } : undefined,
        timestamp: new Date().toISOString(),
        requestId: context?.requestId
      }
    };

    structuredLogger.error('Xero API error', xeroError, {
      component: 'error-handler',
      statusCode,
      ...context
    });

    return NextResponse.json(errorResponse, { status: statusCode === 429 ? 429 : 502 });
  }

  // Handle unknown errors
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  
  structuredLogger.error('Unhandled error', error as Error, {
    component: 'error-handler',
    errorType: 'unknown',
    ...context
  });

  const errorResponse: ErrorResponse = {
    error: {
      type: ErrorType.INTERNAL,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : errorMessage,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      requestId: context?.requestId
    }
  };

  return NextResponse.json(errorResponse, { status: 500 });
}

/**
 * Creates standard error responses
 */
export const createError = {
  validation: (message: string, details?: any) => 
    new AppError(ErrorType.VALIDATION, message, 400, 'VALIDATION_ERROR', details),
  
  authentication: (message = 'Authentication required') => 
    new AppError(ErrorType.AUTHENTICATION, message, 401, 'AUTH_REQUIRED'),
  
  authorization: (message = 'Insufficient permissions') => 
    new AppError(ErrorType.AUTHORIZATION, message, 403, 'FORBIDDEN'),
  
  notFound: (resource: string) => 
    new AppError(ErrorType.NOT_FOUND, `${resource} not found`, 404, 'NOT_FOUND'),
  
  conflict: (message: string) => 
    new AppError(ErrorType.CONFLICT, message, 409, 'CONFLICT'),
  
  rateLimit: (retryAfter?: number) => 
    new AppError(
      ErrorType.RATE_LIMIT, 
      'Too many requests', 
      429, 
      'RATE_LIMIT_EXCEEDED',
      { retryAfter }
    ),
  
  externalService: (service: string, message: string) => 
    new AppError(
      ErrorType.EXTERNAL_SERVICE, 
      `${service} error: ${message}`, 
      502, 
      'EXTERNAL_SERVICE_ERROR'
    ),
  
  database: (operation: string) => 
    new AppError(ErrorType.DATABASE, `Database error during ${operation}`, 500, 'DATABASE_ERROR'),
  
  internal: (message = 'Internal server error') => 
    new AppError(ErrorType.INTERNAL, message, 500, 'INTERNAL_ERROR', undefined, false)
};

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: { endpoint?: string }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error, context);
    }
  }) as T;
}

/**
 * Error boundary for API routes
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options?: {
    endpoint?: string;
    logErrors?: boolean;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
      const response = await handler(...args);
      
      // Log successful requests if needed
      if (options?.logErrors !== false) {
        structuredLogger.info('Request completed', {
          component: 'error-handler',
          endpoint: options?.endpoint,
          duration: Date.now() - startTime,
          requestId
        });
      }
      
      return response;
    } catch (error) {
      return handleError(error, {
        endpoint: options?.endpoint,
        requestId
      });
    }
  }) as T;
}
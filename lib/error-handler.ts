import { NextResponse } from 'next/server';
import { structuredLogger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(`External service error: ${service}`, 503, 'EXTERNAL_SERVICE_ERROR', {
      service,
      originalError: originalError?.message || originalError
    });
    this.name = 'ExternalServiceError';
  }
}

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode: number;
    timestamp: string;
    requestId?: string;
    details?: any;
  };
}

export function handleError(error: any, requestId?: string): NextResponse<ErrorResponse> {
  // Log the error
  structuredLogger.error('Request error', error, {
    component: 'error-handler',
    requestId,
    errorName: error.name,
    errorCode: error.code,
    statusCode: error.statusCode,
    details: error.details
  });

  // Determine status code and message
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code || code;
    details = error.details;
  } else if (error.name === 'PrismaClientKnownRequestError') {
    // Prisma errors
    statusCode = 400;
    code = 'DATABASE_ERROR';
    
    switch (error.code) {
      case 'P2002':
        message = 'Unique constraint violation';
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint violation';
        break;
      default:
        message = 'Database operation failed';
    }
  } else if (error.name === 'ZodError') {
    // Zod validation errors
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = error.errors;
  } else if (error.message?.includes('NEXT_NOT_FOUND')) {
    statusCode = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  }

  // Create error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      details: process.env.NODE_ENV === 'development' ? details : undefined
    }
  };

  // Add retry-after header for rate limit errors
  const headers = new Headers();
  if (error instanceof RateLimitError && error.details?.retryAfter) {
    headers.set('Retry-After', error.details.retryAfter.toString());
  }

  return NextResponse.json(errorResponse, { 
    status: statusCode,
    headers 
  });
}

// Async error wrapper for route handlers
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      const request = args[0];
      const requestId = request?.headers?.get('x-request-id');
      return handleError(error, requestId);
    }
  }) as T;
}

// Error boundary for API routes
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  options?: {
    logErrors?: boolean;
    includeStack?: boolean;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    const request = args[0];
    const requestId = request?.headers?.get('x-request-id') || crypto.randomUUID();
    
    try {
      structuredLogger.info('API request started', {
        component: 'api',
        method: request.method,
        url: request.url,
        requestId
      });
      
      const result = await handler(...args);
      
      const duration = Date.now() - startTime;
      structuredLogger.info('API request completed', {
        component: 'api',
        method: request.method,
        url: request.url,
        requestId,
        duration
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      structuredLogger.error('API request failed', error, {
        component: 'api',
        method: request.method,
        url: request.url,
        requestId,
        duration
      });
      
      return handleError(error, requestId);
    }
  }) as T;
}
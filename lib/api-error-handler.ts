import { NextResponse } from 'next/server';
import { structuredLogger } from './logger';

export enum ErrorCode {
  RATE_LIMITED = 'RATE_LIMITED',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  XERO_API_ERROR = 'XERO_API_ERROR',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  retryAfter?: number;
}

export class ApiErrorHandler {
  static handle(error: any, context: { endpoint: string; operation?: string }): NextResponse {
    structuredLogger.error('API Error', error, {
      component: 'api-error-handler',
      endpoint: context.endpoint,
      operation: context.operation
    });

    // Database timeout errors
    if (error.message?.includes('Operations timed out') || error.code === 'P2024') {
      return NextResponse.json({
        error: {
          code: ErrorCode.DATABASE_TIMEOUT,
          message: 'Database operation timed out. Please try again in a few moments.',
          details: {
            suggestion: 'The system is experiencing high load. Your request will be processed when resources are available.'
          }
        }
      }, { status: 503, headers: { 'Retry-After': '5' } });
    }

    // Rate limit errors
    if (error.status === 429 || error.message?.includes('Rate limit')) {
      const retryAfter = error.retryAfter || 60;
      return NextResponse.json({
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: 'Too many requests. Please wait before trying again.',
          retryAfter
        }
      }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
    }

    // Lock timeout errors
    if (error.message?.includes('Failed to acquire lock')) {
      return NextResponse.json({
        error: {
          code: ErrorCode.LOCK_TIMEOUT,
          message: 'Another operation is in progress. Please wait and try again.',
          details: {
            suggestion: 'A sync operation is already running. It will complete shortly.'
          }
        }
      }, { status: 409, headers: { 'Retry-After': '10' } });
    }

    // Xero API errors
    if (error.statusCode || error.response?.statusCode) {
      const statusCode = error.statusCode || error.response?.statusCode;
      return NextResponse.json({
        error: {
          code: ErrorCode.XERO_API_ERROR,
          message: 'External service error. Please try again later.',
          details: {
            service: 'Xero',
            statusCode
          }
        }
      }, { status: 502 });
    }

    // Default internal error
    return NextResponse.json({
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred. Our team has been notified.',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      }
    }, { status: 500 });
  }

  // Helper to create consistent success responses
  static success(data: any, meta?: { cached?: boolean; fromDate?: Date; toDate?: Date }) {
    return NextResponse.json({
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    });
  }
}
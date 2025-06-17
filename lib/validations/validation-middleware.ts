import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { structuredLogger } from '@/lib/logger';

export type ValidationConfig = {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
};

export function withValidation(
  config: ValidationConfig,
  handler: (
    request: NextRequest,
    validatedData: {
      body?: any;
      query?: any;
      params?: any;
    },
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const validatedData: any = {};
    const errors: Record<string, any> = {};

    try {
      // Validate request body
      if (config.body) {
        try {
          const body = await request.json();
          validatedData.body = config.body.parse(body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.body = formatZodError(error);
          } else {
            errors.body = 'Invalid request body';
          }
        }
      }

      // Validate query parameters
      if (config.query) {
        try {
          const { searchParams } = new URL(request.url);
          const query: Record<string, any> = {};
          
          searchParams.forEach((value, key) => {
            // Handle array parameters
            if (query[key]) {
              if (Array.isArray(query[key])) {
                query[key].push(value);
              } else {
                query[key] = [query[key], value];
              }
            } else {
              query[key] = value;
            }
          });

          validatedData.query = config.query.parse(query);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.query = formatZodError(error);
          } else {
            errors.query = 'Invalid query parameters';
          }
        }
      }

      // Validate route parameters
      if (config.params && context?.params) {
        try {
          validatedData.params = config.params.parse(context.params);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.params = formatZodError(error);
          } else {
            errors.params = 'Invalid route parameters';
          }
        }
      }

      // If there are validation errors, return 400
      if (Object.keys(errors).length > 0) {
        structuredLogger.warn('Validation errors', {
          component: 'validation-middleware',
          endpoint: request.url,
          errors
        });

        return NextResponse.json(
          {
            error: 'Validation failed',
            errors,
            message: 'Please check your request and try again'
          },
          { status: 400 }
        );
      }

      // Call the handler with validated data
      return handler(request, validatedData, context);

    } catch (error: any) {
      structuredLogger.error('Validation middleware error', error, {
        component: 'validation-middleware',
        endpoint: request.url
      });

      return NextResponse.json(
        {
          error: 'Internal server error',
          message: 'An unexpected error occurred during validation'
        },
        { status: 500 }
      );
    }
  };
}

// Format Zod errors for better readability
function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(1000)).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export const dateRangeSchema = z.object({
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional()
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return data.startDate <= data.endDate;
    }
    return true;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['endDate']
  }
);

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required')
});

// Reusable validation schemas
export const transactionFiltersSchema = paginationSchema.extend({
  type: z.enum(['SPEND', 'RECEIVE']).optional(),
  status: z.string().optional(),
  isReconciled: z.string().transform(str => str === 'true').optional(),
  bankAccountId: z.string().optional(),
  contactId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional()
});

export const invoiceFiltersSchema = paginationSchema.extend({
  type: z.enum(['ACCREC', 'ACCPAY']).optional(),
  status: z.string().optional(),
  contactId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional()
});

// Helper to validate and sanitize input
export function sanitizeInput(input: string): string {
  // Remove any potential SQL injection attempts
  return input
    .replace(/[;'"\\]/g, '') // Remove dangerous characters
    .trim()
    .substring(0, 1000); // Limit length
}

// Validate file uploads
export const fileUploadSchema = z.object({
  filename: z.string()
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename')
    .max(255),
  mimetype: z.string()
    .regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9.-]+$/, 'Invalid MIME type'),
  size: z.number()
    .max(10 * 1024 * 1024, 'File size must not exceed 10MB')
});

// Validate API keys and tokens
export const apiKeySchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format')
  .min(32, 'API key too short')
  .max(256, 'API key too long');

// Rate limiting validation
export const rateLimitSchema = z.object({
  identifier: z.string().min(1),
  endpoint: z.string().min(1),
  window: z.number().min(1000).max(3600000), // 1 second to 1 hour
  limit: z.number().min(1).max(10000)
});
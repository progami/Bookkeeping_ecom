import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { structuredLogger } from '@/lib/logger';
import { sanitizeObject } from '@/lib/log-sanitizer';

export interface ValidationConfig {
  querySchema?: z.ZodSchema;
  bodySchema?: z.ZodSchema;
  paramsSchema?: z.ZodSchema;
}

export interface ValidatedData {
  query?: any;
  body?: any;
  params?: any;
}

export function withValidation(
  config: ValidationConfig,
  handler: (request: NextRequest, validatedData: ValidatedData) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const validatedData: ValidatedData = {};
    const errors: Record<string, any> = {};

    try {
      // Validate query parameters
      if (config.querySchema) {
        try {
          const url = new URL(request.url);
          const queryParams = Object.fromEntries(url.searchParams.entries());
          validatedData.query = config.querySchema.parse(queryParams);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.query = formatZodError(error);
          } else {
            errors.query = 'Invalid query parameters';
          }
        }
      }

      // Validate request body
      if (config.bodySchema && request.method !== 'GET') {
        try {
          const body = await request.json();
          validatedData.body = config.bodySchema.parse(body);
          
          // Add sanitized request body logging
          structuredLogger.debug('Sanitized request body received', {
            component: 'validation-middleware',
            endpoint: request.url,
            method: request.method,
            body: sanitizeObject(validatedData.body)
          });
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.body = formatZodError(error);
          } else {
            errors.body = 'Invalid request body';
          }
        }
      }

      // If there are validation errors, return 400
      if (Object.keys(errors).length > 0) {
        structuredLogger.warn('Validation errors', {
          component: 'validation-middleware',
          endpoint: request.url,
          method: request.method,
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
      return handler(request, validatedData);

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
import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';
import { structuredLogger } from '@/lib/logger';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationErrorResponse {
  error: string;
  message: string;
  validationErrors: ValidationError[];
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T | null; error: NextResponse | null }> {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      structuredLogger.warn('Request validation failed', {
        component: 'validation-middleware',
        path: request.nextUrl.pathname,
        errors: validationErrors
      });

      const response: ValidationErrorResponse = {
        error: 'Validation failed',
        message: 'Invalid request data',
        validationErrors
      };

      return {
        data: null,
        error: NextResponse.json(response, { status: 400 })
      };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return {
        data: null,
        error: NextResponse.json({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        }, { status: 400 })
      };
    }

    // Handle other errors
    structuredLogger.error('Unexpected validation error', error, {
      component: 'validation-middleware',
      path: request.nextUrl.pathname
    });

    return {
      data: null,
      error: NextResponse.json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      }, { status: 500 })
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): { data: T | null; error: NextResponse | null } {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query: Record<string, any> = {};
    
    // Convert URLSearchParams to object
    searchParams.forEach((value, key) => {
      // Handle array parameters (e.g., ?id=1&id=2)
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

    const data = schema.parse(query);
    return { data, error: null };
  } catch (error) {
    if (error instanceof ZodError) {
      const validationErrors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      structuredLogger.warn('Query validation failed', {
        component: 'validation-middleware',
        path: request.nextUrl.pathname,
        errors: validationErrors
      });

      const response: ValidationErrorResponse = {
        error: 'Validation failed',
        message: 'Invalid query parameters',
        validationErrors
      };

      return {
        data: null,
        error: NextResponse.json(response, { status: 400 })
      };
    }

    return {
      data: null,
      error: NextResponse.json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      }, { status: 500 })
    };
  }
}

/**
 * Higher-order function to wrap API route handlers with validation
 */
export function withValidation<TBody = any, TQuery = any>(
  options: {
    bodySchema?: ZodSchema<TBody>;
    querySchema?: ZodSchema<TQuery>;
  },
  handler: (
    request: NextRequest,
    context: {
      body?: TBody;
      query?: TQuery;
      params?: any;
    }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, props?: { params?: any }): Promise<NextResponse> => {
    const context: { body?: TBody; query?: TQuery; params?: any } = {
      params: props?.params
    };

    // Validate body if schema provided
    if (options.bodySchema) {
      const { data, error } = await validateBody(request, options.bodySchema);
      if (error) return error;
      context.body = data!;
    }

    // Validate query if schema provided
    if (options.querySchema) {
      const { data, error } = validateQuery(request, options.querySchema);
      if (error) return error;
      context.query = data!;
    }

    // Call the handler with validated data
    try {
      return await handler(request, context);
    } catch (error) {
      structuredLogger.error('Handler error after validation', error, {
        component: 'validation-middleware',
        path: request.nextUrl.pathname
      });

      return NextResponse.json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      }, { status: 500 });
    }
  };
}

/**
 * Sanitize user input to prevent XSS and injection attacks
 */
export function sanitizeInput(input: string): string {
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}
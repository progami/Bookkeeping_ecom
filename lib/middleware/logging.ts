import { NextRequest, NextResponse } from 'next/server';
import { Logger } from '@/lib/logger-enhanced';
import crypto from 'crypto';

// Extend NextRequest to include logger
declare module 'next/server' {
  interface NextRequest {
    logger?: Logger;
    requestId?: string;
  }
}

export function withLogging(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const start = Date.now();
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    
    // Create logger for this request
    const logger = new Logger({ 
      requestId,
      method: request.method,
      url: request.url,
      path: new URL(request.url).pathname,
    });
    
    // Attach to request
    (request as any).logger = logger;
    (request as any).requestId = requestId;
    
    // Log incoming request
    const requestData: any = {
      headers: Object.fromEntries(request.headers.entries()),
      query: Object.fromEntries(new URL(request.url).searchParams.entries()),
    };
    
    // Get body for logging (if present)
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      try {
        const bodyText = await request.text();
        if (bodyText) {
          try {
            requestData.body = JSON.parse(bodyText);
            // Recreate request with body
            request = new NextRequest(request.url, {
              method: request.method,
              headers: request.headers,
              body: bodyText,
            });
          } catch (e) {
            requestData.body = bodyText;
          }
        }
      } catch (e) {
        // Ignore body parsing errors
      }
    }
    
    logger.http(`⟵ ${request.method} ${new URL(request.url).pathname}`, requestData);
    
    try {
      // Call the handler
      const response = await handler(request, ...args);
      
      // Log response
      const duration = Date.now() - start;
      const responseData: any = {
        statusCode: response.status,
        duration,
        headers: Object.fromEntries(response.headers.entries()),
      };
      
      // Add response body for errors or debug
      if (response.status >= 400 || process.env.LOG_LEVEL === 'debug') {
        try {
          const clonedResponse = response.clone();
          const responseText = await clonedResponse.text();
          if (responseText) {
            try {
              responseData.body = JSON.parse(responseText);
            } catch (e) {
              if (responseText.length < 1000) {
                responseData.body = responseText;
              }
            }
          }
        } catch (e) {
          // Ignore response parsing errors
        }
      }
      
      // Log with appropriate level
      if (response.status >= 500) {
        logger.error(`⟶ ${request.method} ${new URL(request.url).pathname} ${response.status} ${duration}ms`, responseData);
      } else if (response.status >= 400) {
        logger.warn(`⟶ ${request.method} ${new URL(request.url).pathname} ${response.status} ${duration}ms`, responseData);
      } else {
        logger.http(`⟶ ${request.method} ${new URL(request.url).pathname} ${response.status} ${duration}ms`, responseData);
      }
      
      // Add request ID to response headers
      const headers = new Headers(response.headers);
      headers.set('X-Request-ID', requestId);
      
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(`⟶ ${request.method} ${new URL(request.url).pathname} 500 ${duration}ms`, error);
      
      return NextResponse.json(
        { 
          error: 'Internal Server Error',
          requestId,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { 
          status: 500,
          headers: {
            'X-Request-ID': requestId,
          },
        }
      );
    }
  };
}
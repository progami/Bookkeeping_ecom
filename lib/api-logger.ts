import { NextRequest } from 'next/server';
import { Logger, structuredLogger } from '@/lib/logger';

/**
 * Get logger instance for API route
 * Extracts request ID and creates a child logger with request context
 */
export function getApiLogger(request: NextRequest): Logger {
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const url = new URL(request.url);
  
  return structuredLogger.child({
    requestId,
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
  });
}

/**
 * Log API call with timing and response data
 */
export async function logApiCall<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  
  try {
    logger.debug(`Starting ${operation}`);
    const result = await fn();
    const duration = Date.now() - start;
    
    logger.info(`Completed ${operation}`, {
      operation,
      duration,
      success: true,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logger.error(`Failed ${operation}`, error, {
      operation,
      duration,
      success: false,
    });
    
    throw error;
  }
}

/**
 * Log external API calls (e.g., to Xero)
 */
export function logExternalApi(
  logger: Logger,
  service: string,
  method: string,
  endpoint: string,
  data?: {
    params?: any;
    body?: any;
    response?: any;
    error?: any;
    duration?: number;
  }
) {
  const logData: any = {
    service,
    api: {
      method,
      endpoint,
      timestamp: new Date().toISOString(),
    },
  };
  
  if (data) {
    if (data.params) logData.api.params = data.params;
    if (data.body) logData.api.body = data.body;
    if (data.response) logData.api.response = data.response;
    if (data.error) logData.api.error = data.error;
    if (data.duration) logData.api.duration = data.duration;
  }
  
  const message = `${service} API: ${method} ${endpoint}`;
  
  if (data?.error) {
    logger.error(message, data.error, logData);
  } else {
    logger.info(message, logData);
  }
}
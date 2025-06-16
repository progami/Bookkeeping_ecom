import { structuredLogger } from './logger';
import { prisma } from './prisma';

export interface ErrorContext {
  userId?: string;
  tenantId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  component?: string;
  requestId?: string;
  [key: string]: any;
}

export interface MonitoredError extends Error {
  code?: string;
  statusCode?: number;
  context?: ErrorContext;
  fingerprint?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

class ErrorMonitor {
  private errorQueue: MonitoredError[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxQueueSize = 100;
  private readonly flushIntervalMs = 60000; // 1 minute

  constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
  }

  private startPeriodicFlush() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  private generateFingerprint(error: MonitoredError): string {
    // Create a unique fingerprint for error grouping
    const parts = [
      error.name,
      error.code,
      error.message.substring(0, 100), // First 100 chars
      error.context?.component,
      error.context?.endpoint
    ].filter(Boolean);

    return parts.join(':');
  }

  private getSeverity(error: MonitoredError): string {
    if (error.severity) return error.severity;

    // Auto-determine severity based on error characteristics
    const statusCode = error.statusCode || error.context?.statusCode;
    
    if (statusCode) {
      if (statusCode >= 500) return 'high';
      if (statusCode >= 400) return 'medium';
      return 'low';
    }

    // Check error codes
    if (error.code) {
      if (error.code.includes('CRITICAL') || error.code.includes('FATAL')) return 'critical';
      if (error.code.includes('ERROR')) return 'high';
      if (error.code.includes('WARN')) return 'medium';
    }

    return 'medium';
  }

  async captureError(error: Error, context?: ErrorContext): Promise<void> {
    try {
      const monitoredError = error as MonitoredError;
      monitoredError.context = { ...monitoredError.context, ...context };
      monitoredError.fingerprint = this.generateFingerprint(monitoredError);
      monitoredError.severity = this.getSeverity(monitoredError) as any;

      // Log immediately
      structuredLogger.error('Monitored error captured', error, {
        component: 'error-monitor',
        fingerprint: monitoredError.fingerprint,
        severity: monitoredError.severity,
        ...context
      });

      // Add to queue for batch processing
      this.errorQueue.push(monitoredError);

      // Flush if queue is full
      if (this.errorQueue.length >= this.maxQueueSize) {
        await this.flush();
      }

      // For critical errors, notify immediately
      if (monitoredError.severity === 'critical') {
        await this.notifyCriticalError(monitoredError);
      }
    } catch (captureError) {
      // Don't let error monitoring errors break the app
      console.error('Error in error monitoring:', captureError);
    }
  }

  async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      // Store errors in database for analysis
      await prisma.$transaction(
        errors.map(error => 
          prisma.errorLog.create({
            data: {
              fingerprint: error.fingerprint || 'unknown',
              errorName: error.name,
              errorMessage: error.message,
              errorStack: error.stack,
              errorCode: error.code,
              severity: error.severity || 'medium',
              context: JSON.stringify(error.context || {}),
              occurredAt: new Date()
            }
          })
        )
      );

      // Group errors by fingerprint for summary
      const errorGroups = errors.reduce((acc, error) => {
        const fp = error.fingerprint || 'unknown';
        acc[fp] = (acc[fp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      structuredLogger.info('Error batch stored', {
        component: 'error-monitor',
        totalErrors: errors.length,
        uniqueErrors: Object.keys(errorGroups).length,
        errorGroups
      });
    } catch (flushError) {
      console.error('Failed to flush error queue:', flushError);
    }
  }

  private async notifyCriticalError(error: MonitoredError): Promise<void> {
    // In production, this would send alerts via email, Slack, PagerDuty, etc.
    structuredLogger.error('CRITICAL ERROR ALERT', error, {
      component: 'error-monitor',
      alert: true,
      severity: 'critical',
      fingerprint: error.fingerprint,
      requiresImmediateAttention: true
    });

    // Could integrate with notification services here
    // await sendSlackAlert(error);
    // await sendEmail(error);
  }

  async getErrorStats(hours: number = 24): Promise<any> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [totalErrors, errorsBySeverity, topErrors] = await Promise.all([
      // Total error count
      prisma.errorLog.count({
        where: { occurredAt: { gte: since } }
      }),

      // Errors grouped by severity
      prisma.errorLog.groupBy({
        by: ['severity'],
        _count: true,
        where: { occurredAt: { gte: since } }
      }),

      // Top errors by fingerprint
      prisma.errorLog.groupBy({
        by: ['fingerprint', 'errorName'],
        _count: true,
        where: { occurredAt: { gte: since } },
        orderBy: { _count: { fingerprint: 'desc' } },
        take: 10
      })
    ]);

    return {
      totalErrors,
      errorsBySeverity: errorsBySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {} as Record<string, number>),
      topErrors: topErrors.map(item => ({
        fingerprint: item.fingerprint,
        errorName: item.errorName,
        count: item._count
      })),
      timeRange: { hours, since }
    };
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flush();
  }
}

// Global error monitor instance
export const errorMonitor = new ErrorMonitor();

// Express/Next.js error handler middleware
export function errorHandler(
  error: Error,
  req: any,
  res: any,
  next: any
) {
  const context: ErrorContext = {
    endpoint: req.url,
    method: req.method,
    requestId: req.headers['x-request-id'],
    userAgent: req.headers['user-agent']
  };

  errorMonitor.captureError(error, context);

  // Send appropriate response
  const statusCode = (error as any).statusCode || 500;
  res.status(statusCode).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    requestId: context.requestId
  });
}

// Global error handlers
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (error: Error) => {
    errorMonitor.captureError(error, {
      component: 'process',
      type: 'uncaughtException',
      severity: 'critical'
    });
    // Give time to flush
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    const error = new Error(`Unhandled Rejection: ${reason}`);
    errorMonitor.captureError(error, {
      component: 'process',
      type: 'unhandledRejection',
      severity: 'high'
    });
  });

  process.on('exit', () => {
    errorMonitor.destroy();
  });
}

// Helper function for API routes
export function withErrorMonitoring<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  componentName: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      await errorMonitor.captureError(error, {
        component: componentName,
        args: args.length > 0 ? 'provided' : 'none'
      });
      throw error;
    }
  }) as T;
}
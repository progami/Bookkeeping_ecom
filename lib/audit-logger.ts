/**
 * Comprehensive audit logging system for financial operations
 * Tracks all critical operations for compliance and debugging
 */

import { prisma } from './prisma';
import { logger } from './logger';
import { FinancialCalc } from './financial-calculations';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  duration?: number;
}

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // Data Access
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  
  // Data Modification
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  
  // Sync Operations
  SYNC_START = 'SYNC_START',
  SYNC_COMPLETE = 'SYNC_COMPLETE',
  SYNC_FAILED = 'SYNC_FAILED',
  
  // Financial Operations
  CALCULATE = 'CALCULATE',
  RECONCILE = 'RECONCILE',
  REPORT_GENERATE = 'REPORT_GENERATE',
  
  // System Operations
  CONFIG_CHANGE = 'CONFIG_CHANGE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  ERROR = 'ERROR'
}

export enum AuditResource {
  // Authentication
  AUTH_SESSION = 'AUTH_SESSION',
  XERO_TOKEN = 'XERO_TOKEN',
  
  // Financial Data
  INVOICE = 'INVOICE',
  BILL = 'BILL',
  TRANSACTION = 'TRANSACTION',
  ACCOUNT = 'ACCOUNT',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  
  // Reports
  BALANCE_SHEET = 'BALANCE_SHEET',
  PROFIT_LOSS = 'PROFIT_LOSS',
  CASH_FLOW = 'CASH_FLOW',
  FINANCIAL_SUMMARY = 'FINANCIAL_SUMMARY',
  
  // Sync
  SYNC_OPERATION = 'SYNC_OPERATION',
  
  // System
  CONFIGURATION = 'CONFIGURATION',
  USER_PERMISSION = 'USER_PERMISSION',
  SYSTEM = 'SYSTEM'
}

class AuditLogger {
  /**
   * Log an audit entry
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Store in database
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          userEmail: entry.userEmail,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          metadata: JSON.stringify(entry.metadata || {}),
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          status: entry.status,
          errorMessage: entry.errorMessage,
          duration: entry.duration,
          timestamp: new Date()
        }
      });
      
      // Also log to structured logger for immediate visibility
      const logLevel = entry.status === 'failure' ? 'error' : 'info';
      logger[logLevel]('Audit log entry', {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        status: entry.status,
        userId: entry.userId,
        duration: Date.now() - startTime
      });
      
    } catch (error) {
      // Don't let audit logging failures break the application
      logger.error('Failed to write audit log', error as Error, {
        action: entry.action,
        resource: entry.resource
      });
    }
  }
  
  /**
   * Log a successful operation
   */
  async logSuccess(
    action: AuditAction,
    resource: AuditResource,
    details: Partial<AuditLogEntry> = {}
  ): Promise<void> {
    await this.log({
      action,
      resource,
      status: 'success',
      ...details
    });
  }
  
  /**
   * Log a failed operation
   */
  async logFailure(
    action: AuditAction,
    resource: AuditResource,
    error: Error | string,
    details: Partial<AuditLogEntry> = {}
  ): Promise<void> {
    await this.log({
      action,
      resource,
      status: 'failure',
      errorMessage: typeof error === 'string' ? error : error.message,
      ...details
    });
  }
  
  /**
   * Log a financial calculation with precision tracking
   */
  async logFinancialCalculation(
    operation: string,
    inputs: Record<string, any>,
    outputs: Record<string, any>,
    details: Partial<AuditLogEntry> = {}
  ): Promise<void> {
    // Convert all numeric values to strings to preserve precision
    const sanitizedInputs = Object.entries(inputs).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'number' ? FinancialCalc.toCurrency(value) : value;
      return acc;
    }, {} as Record<string, any>);
    
    const sanitizedOutputs = Object.entries(outputs).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'number' ? FinancialCalc.toCurrency(value) : value;
      return acc;
    }, {} as Record<string, any>);
    
    await this.log({
      action: AuditAction.CALCULATE,
      resource: AuditResource.SYSTEM,
      status: 'success',
      metadata: {
        operation,
        inputs: sanitizedInputs,
        outputs: sanitizedOutputs,
        timestamp: new Date().toISOString()
      },
      ...details
    });
  }
  
  /**
   * Query audit logs
   */
  async query(params: {
    userId?: string;
    action?: AuditAction;
    resource?: AuditResource;
    resourceId?: string;
    status?: 'success' | 'failure';
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;
    if (params.resourceId) where.resourceId = params.resourceId;
    if (params.status) where.status = params.status;
    
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }
    
    return await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit || 100,
      skip: params.offset || 0
    });
  }
  
  /**
   * Get audit summary statistics
   */
  async getSummary(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'action' | 'resource' | 'user' | 'status';
  }) {
    const where: any = {};
    
    if (params.startDate || params.endDate) {
      where.timestamp = {};
      if (params.startDate) where.timestamp.gte = params.startDate;
      if (params.endDate) where.timestamp.lte = params.endDate;
    }
    
    const groupBy = params.groupBy || 'action';
    
    const results = await prisma.auditLog.groupBy({
      by: [groupBy as any],
      where,
      _count: {
        _all: true
      }
    });
    
    return results.map(result => ({
      [groupBy]: result[groupBy as keyof typeof result],
      count: result._count._all
    }));
  }
  
  /**
   * Clean up old audit logs
   */
  async cleanup(retentionDays: number = 365): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    
    logger.info(`Cleaned up ${result.count} audit log entries older than ${retentionDays} days`);
    return result.count;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Middleware helper for Express/Next.js routes
export function withAuditLogging(
  action: AuditAction,
  resource: AuditResource,
  handler: Function
) {
  return async (req: any, res: any, ...args: any[]) => {
    const startTime = Date.now();
    const auditEntry: Partial<AuditLogEntry> = {
      ipAddress: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        method: req.method,
        path: req.url,
        query: req.query,
        bodyKeys: req.body ? Object.keys(req.body) : []
      }
    };
    
    try {
      const result = await handler(req, res, ...args);
      
      // Log success
      await auditLogger.logSuccess(action, resource, {
        ...auditEntry,
        duration: Date.now() - startTime
      });
      
      return result;
    } catch (error) {
      // Log failure
      await auditLogger.logFailure(action, resource, error as Error, {
        ...auditEntry,
        duration: Date.now() - startTime
      });
      
      throw error;
    }
  };
}
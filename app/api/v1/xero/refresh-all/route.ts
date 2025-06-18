import { NextRequest, NextResponse } from 'next/server';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withErrorHandling, createError } from '@/lib/errors/error-handler';
import { xeroDataCache } from '@/lib/xero-data-cache';
import { structuredLogger } from '@/lib/logger';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { withRateLimit } from '@/lib/rate-limiter';
import { withLock, LOCK_RESOURCES } from '@/lib/redis-lock';

/**
 * Global refresh endpoint - fetches all Xero data and caches it
 * Prevents repeated API calls during sessions
 */
export const POST = withRateLimit(
  withErrorHandling(
    withAuthValidation(
      { authLevel: ValidationLevel.XERO },
      async (request, { session }) => {
        const startTime = Date.now();
        
        // Prevent concurrent refreshes using lock
        return await withLock(LOCK_RESOURCES.XERO_SYNC, 300000, async () => { // 5 minutes
          try {
            structuredLogger.info('Starting global Xero data refresh', {
              component: 'xero-refresh-all',
              userId: session.user.userId,
              tenantId: session.user.tenantId
            });
            
            // Refresh all cached data
            await xeroDataCache.refreshAll(
              session.user.tenantId,
              session.user.userId
            );
            
            // Log success
            await auditLogger.logSuccess(
              AuditAction.DATA_REFRESH,
              AuditResource.XERO_API,
              {
                metadata: {
                  userId: session.user.userId,
                  tenantId: session.user.tenantId,
                  refreshType: 'global'
                },
                duration: Date.now() - startTime
              }
            );
            
            // Get cache stats
            const stats = xeroDataCache.getStats();
            
            return NextResponse.json({
              success: true,
              message: 'Xero data refreshed successfully',
              refreshedAt: new Date().toISOString(),
              cacheStats: {
                entriesCount: stats.size,
                entries: stats.entries.map(e => ({
                  key: e.key.split(':')[0], // Only show cache key type
                  ageMinutes: Math.floor(e.age / 60000)
                }))
              },
              duration: Date.now() - startTime
            });
          } catch (error) {
            // Log failure
            await auditLogger.logFailure(
              AuditAction.DATA_REFRESH,
              AuditResource.XERO_API,
              error as Error,
              {
                metadata: {
                  userId: session.user.userId,
                  tenantId: session.user.tenantId,
                  refreshType: 'global'
                },
                duration: Date.now() - startTime
              }
            );
            
            throw error;
          }
        });
      }
    ),
    { endpoint: '/api/v1/xero/refresh-all' }
  ),
  {
    limit: 10, // Max 10 refresh requests per minute
    windowMs: 60000
  }
);
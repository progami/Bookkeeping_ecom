import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { memoryMonitor } from '@/lib/memory-monitor';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const healthChecks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {} as Record<string, any>,
      errors: [] as string[]
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      healthChecks.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        message: 'Database connection successful'
      };
    } catch (error: any) {
      healthChecks.status = 'unhealthy';
      healthChecks.checks.database = {
        status: 'unhealthy',
        error: error.message
      };
      healthChecks.errors.push('Database connection failed');
    }

    // Check Redis connectivity
    try {
      const redisStart = Date.now();
      await redis.ping();
      healthChecks.checks.redis = {
        status: 'healthy',
        responseTime: Date.now() - redisStart,
        message: 'Redis connection successful'
      };
    } catch (error: any) {
      // Redis is optional, so just mark as degraded
      healthChecks.checks.redis = {
        status: 'degraded',
        error: error.message,
        message: 'Redis unavailable - using in-memory fallback'
      };
    }

    // Check memory usage
    const memoryStats = memoryMonitor.getMemoryStats();
    const memoryStatus = memoryStats.percentUsed > 0.9 ? 'critical' : 
                        memoryStats.percentUsed > 0.8 ? 'warning' : 'healthy';
    
    if (memoryStatus !== 'healthy') {
      healthChecks.status = memoryStatus === 'critical' ? 'unhealthy' : 'degraded';
    }
    
    healthChecks.checks.memory = {
      status: memoryStatus,
      heapUsedMB: memoryStats.heapUsedMB,
      heapTotalMB: memoryStats.heapTotalMB,
      percentUsed: Math.round(memoryStats.percentUsed * 100)
    };

    // Check recent sync status
    try {
      const recentSync = await prisma.syncLog.findFirst({
        orderBy: { startedAt: 'desc' },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true
        }
      });

      if (recentSync) {
        const hoursSinceSync = (Date.now() - recentSync.startedAt.getTime()) / (1000 * 60 * 60);
        const syncStatus = recentSync.status === 'failed' ? 'unhealthy' :
                          hoursSinceSync > 24 ? 'warning' : 'healthy';
        
        healthChecks.checks.dataSync = {
          status: syncStatus,
          lastSync: recentSync.startedAt.toISOString(),
          lastSyncStatus: recentSync.status,
          hoursSinceSync: Math.round(hoursSinceSync * 10) / 10,
          errorMessage: recentSync.errorMessage
        };

        if (syncStatus === 'unhealthy') {
          healthChecks.status = 'degraded';
          healthChecks.errors.push('Last sync failed');
        }
      } else {
        healthChecks.checks.dataSync = {
          status: 'unknown',
          message: 'No sync history found'
        };
      }
    } catch (error: any) {
      healthChecks.checks.dataSync = {
        status: 'error',
        error: error.message
      };
    }

    // Check critical tables have data
    try {
      const [bankAccounts, glAccounts, transactions] = await Promise.all([
        prisma.bankAccount.count(),
        prisma.gLAccount.count(),
        prisma.bankTransaction.count({ take: 1 })
      ]);

      healthChecks.checks.dataIntegrity = {
        status: bankAccounts > 0 && glAccounts > 0 ? 'healthy' : 'warning',
        bankAccounts,
        glAccounts,
        hasTransactions: transactions > 0
      };

      if (bankAccounts === 0 || glAccounts === 0) {
        healthChecks.status = 'degraded';
        healthChecks.errors.push('Missing critical data - sync required');
      }
    } catch (error: any) {
      healthChecks.checks.dataIntegrity = {
        status: 'error',
        error: error.message
      };
    }

    // Process uptime
    const uptime = process.uptime();
    healthChecks.checks.process = {
      uptime: Math.round(uptime),
      uptimeHuman: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      pid: process.pid,
      version: process.version
    };

    // Overall status summary
    const statusCode = healthChecks.status === 'healthy' ? 200 : 
                      healthChecks.status === 'degraded' ? 200 : 503;

    return NextResponse.json(healthChecks, { status: statusCode });
    
  } catch (error: any) {
    structuredLogger.error('Health check failed', error, { 
      component: 'system-health' 
    });
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      status: 'error',
      error: 'Health check failed',
      message: error.message
    }, { status: 503 });
  }
}
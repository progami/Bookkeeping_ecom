import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { structuredLogger } from '@/lib/logger';

// Metrics collection
interface SystemMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  database: {
    connected: boolean;
    queryTime: number;
    connections: number;
  };
  redis: {
    connected: boolean;
    memory: number;
    clients: number;
  };
  application: {
    requests: {
      total: number;
      errors: number;
      averageResponseTime: number;
    };
    xero: {
      lastSync: Date | null;
      syncedRecords: number;
      failedSyncs: number;
    };
    bankTransactions: number;
    invoices: number;
    glAccounts: number;
  };
}

// In-memory request metrics (would use Redis in production)
const requestMetrics = {
  total: 0,
  errors: 0,
  responseTimes: [] as number[],
};

// Helper function for recording requests (not exported as route handler)
function recordRequest(responseTime: number, isError: boolean = false) {
  requestMetrics.total++;
  if (isError) requestMetrics.errors++;
  
  // Keep last 1000 response times
  requestMetrics.responseTimes.push(responseTime);
  if (requestMetrics.responseTimes.length > 1000) {
    requestMetrics.responseTimes.shift();
  }
}

export async function GET() {
  try {
    const startTime = Date.now();
    
    // System metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Database metrics
    let dbConnected = false;
    let dbQueryTime = 0;
    let dbConnections = 0;
    
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbQueryTime = Date.now() - dbStart;
      dbConnected = true;
      
      // Get connection count (SQLite doesn't have this, but in production with PostgreSQL you would)
      dbConnections = 1; // SQLite only has one connection
    } catch (error) {
      structuredLogger.error('Database health check failed', error, { component: 'metrics' });
    }
    
    // Redis metrics
    let redisConnected = false;
    let redisMemory = 0;
    let redisClients = 0;
    
    if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://disabled') {
      try {
        const redisInfo = await redis.info();
        redisConnected = true;
        
        // Parse Redis info
        const lines = redisInfo.split('\r\n');
        for (const line of lines) {
          if (line.startsWith('used_memory:')) {
            redisMemory = parseInt(line.split(':')[1]);
          } else if (line.startsWith('connected_clients:')) {
            redisClients = parseInt(line.split(':')[1]);
          }
        }
      } catch (error) {
        structuredLogger.error('Redis health check failed', error, { component: 'metrics' });
      }
    }
    
    // Application metrics
    const [
      lastSync,
      syncedRecordsCount,
      failedSyncsCount,
      transactionCount,
      invoiceCount,
      glAccountCount
    ] = await Promise.all([
      // Last successful sync
      prisma.syncLog.findFirst({
        where: { status: 'success' },
        orderBy: { completedAt: 'desc' }
      }),
      
      // Total synced records
      prisma.syncLog.aggregate({
        where: { status: 'success' },
        _sum: {
          recordsCreated: true,
          recordsUpdated: true
        }
      }),
      
      // Failed syncs in last 24 hours
      prisma.syncLog.count({
        where: {
          status: 'failed',
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total bank transactions
      prisma.bankTransaction.count(),
      
      // Total invoices
      prisma.syncedInvoice.count(),
      
      // Total GL accounts
      prisma.gLAccount.count()
    ]);
    
    // Calculate average response time
    const avgResponseTime = requestMetrics.responseTimes.length > 0
      ? requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / requestMetrics.responseTimes.length
      : 0;
    
    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      database: {
        connected: dbConnected,
        queryTime: dbQueryTime,
        connections: dbConnections
      },
      redis: {
        connected: redisConnected,
        memory: redisMemory,
        clients: redisClients
      },
      application: {
        requests: {
          total: requestMetrics.total,
          errors: requestMetrics.errors,
          averageResponseTime: avgResponseTime
        },
        xero: {
          lastSync: lastSync?.completedAt || null,
          syncedRecords: (syncedRecordsCount._sum.recordsCreated || 0) + 
                        (syncedRecordsCount._sum.recordsUpdated || 0),
          failedSyncs: failedSyncsCount
        },
        bankTransactions: transactionCount,
        invoices: invoiceCount,
        glAccounts: glAccountCount
      }
    };
    
    // Log metrics collection
    structuredLogger.info('Metrics collected', {
      component: 'metrics',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(metrics);
  } catch (error) {
    structuredLogger.error('Failed to collect metrics', error, { component: 'metrics' });
    return NextResponse.json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
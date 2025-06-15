import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { getXeroClient } from '@/lib/xero-client';
import { logger } from '@/lib/log-sanitizer';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    xero: HealthCheck;
    memory: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  message?: string;
  details?: any;
}

// Track application start time
const startTime = Date.now();

export async function GET(request: NextRequest) {
  const healthChecks: HealthCheckResult = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: { status: 'pass' },
      redis: { status: 'pass' },
      xero: { status: 'pass' },
      memory: { status: 'pass' }
    }
  };

  // Check database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const count = await prisma.bankAccount.count();
    healthChecks.checks.database = {
      status: 'pass',
      responseTime: Date.now() - dbStart,
      details: { connected: true, records: count }
    };
  } catch (error: any) {
    logger.error('Health check - Database failed:', error);
    healthChecks.checks.database = {
      status: 'fail',
      responseTime: Date.now() - dbStart,
      message: 'Database connection failed',
      details: { error: error.message }
    };
    healthChecks.status = 'unhealthy';
  }

  // Check Redis connectivity (optional - might be disabled)
  const redisStart = Date.now();
  try {
    if (redis.status === 'ready') {
      await redis.ping();
      healthChecks.checks.redis = {
        status: 'pass',
        responseTime: Date.now() - redisStart,
        details: { connected: true, status: redis.status }
      };
    } else {
      healthChecks.checks.redis = {
        status: 'warn',
        responseTime: Date.now() - redisStart,
        message: 'Redis not connected',
        details: { status: redis.status }
      };
      if (healthChecks.status === 'healthy') {
        healthChecks.status = 'degraded';
      }
    }
  } catch (error: any) {
    logger.error('Health check - Redis failed:', error);
    healthChecks.checks.redis = {
      status: 'warn',
      responseTime: Date.now() - redisStart,
      message: 'Redis check failed',
      details: { error: error.message }
    };
    if (healthChecks.status === 'healthy') {
      healthChecks.status = 'degraded';
    }
  }

  // Check Xero connectivity
  const xeroStart = Date.now();
  try {
    const xeroClient = await getXeroClient();
    if (xeroClient) {
      healthChecks.checks.xero = {
        status: 'pass',
        responseTime: Date.now() - xeroStart,
        details: { authenticated: true }
      };
    } else {
      healthChecks.checks.xero = {
        status: 'warn',
        responseTime: Date.now() - xeroStart,
        message: 'Xero not authenticated',
        details: { authenticated: false }
      };
    }
  } catch (error: any) {
    logger.error('Health check - Xero failed:', error);
    healthChecks.checks.xero = {
      status: 'warn',
      responseTime: Date.now() - xeroStart,
      message: 'Xero check failed',
      details: { error: error.message }
    };
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  if (heapUsedPercent > 90) {
    healthChecks.checks.memory = {
      status: 'fail',
      message: 'Memory usage critical',
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    };
    healthChecks.status = 'unhealthy';
  } else if (heapUsedPercent > 80) {
    healthChecks.checks.memory = {
      status: 'warn',
      message: 'Memory usage high',
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    };
    if (healthChecks.status === 'healthy') {
      healthChecks.status = 'degraded';
    }
  } else {
    healthChecks.checks.memory = {
      status: 'pass',
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedPercent: Math.round(heapUsedPercent),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    };
  }

  // Return appropriate HTTP status code
  const httpStatus = healthChecks.status === 'unhealthy' ? 503 : 200;

  return NextResponse.json(healthChecks, { status: httpStatus });
}

// Lightweight health check for load balancers
export async function HEAD(request: NextRequest) {
  try {
    // Quick database check
    await prisma.$queryRaw`SELECT 1`;
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
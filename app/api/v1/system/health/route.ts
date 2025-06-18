import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisStatus } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
    environment: process.env.NODE_ENV || 'development',
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'unhealthy';
  }

  // Check Redis connection
  try {
    const redisStatus = await getRedisStatus();
    health.services.redis = redisStatus.connected ? 'connected' : 'disconnected';
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'unhealthy';
  }

  const responseTime = Date.now() - startTime;

  return NextResponse.json({
    ...health,
    responseTime: `${responseTime}ms`,
  });
}
import Redis from 'ioredis';
import { structuredLogger as logger } from './logger';

// Create a Redis client instance
// Support both individual config and URL format
const redisUrl = process.env.REDIS_URL;

export const redis = redisUrl ? new Redis(redisUrl) : new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Retry strategy for production
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Connection options
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  
  // Optional: key prefix to avoid conflicts
  keyPrefix: 'bookkeeping:',
});

// Handle connection events - only log once per process
const globalAny = global as any;
if (!globalAny.__redisListenersAdded) {
  globalAny.__redisListenersAdded = true;
  
  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis error', err);
  });

  redis.on('close', () => {
    logger.info('Redis connection closed');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await redis.quit();
  process.exit(0);
});

// Export status helper
export async function getRedisStatus() {
  try {
    const status = redis.status;
    return {
      connected: status === 'ready',
      status
    };
  } catch (error) {
    return {
      connected: false,
      status: 'error'
    };
  }
}
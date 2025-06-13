import Redis from 'ioredis';

// Create a Redis client instance
export const redis = new Redis({
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

// Handle connection events
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await redis.quit();
  process.exit(0);
});
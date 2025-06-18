import Redis from 'ioredis';
import { structuredLogger } from './logger';

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
});

redis.on('error', (err) => {
  structuredLogger.error('[RedisLock] Redis connection error:', err);
});

redis.on('connect', () => {
  structuredLogger.info('[RedisLock] Redis connected');
});

export const LOCK_RESOURCES = {
  XERO_SYNC: 'xero:sync',
  XERO_REFRESH: 'xero:refresh',
  XERO_TOKEN_REFRESH: 'xero:token:refresh',
  TRANSACTION_PROCESSING: 'transaction:processing'
};

// Acquire lock with retry logic
async function acquireLock(key: string, ttl: number, retries = 10, retryDelay = 100): Promise<boolean> {
  const lockValue = `${process.pid}:${Date.now()}`;
  
  for (let i = 0; i < retries; i++) {
    try {
      // SET key value NX PX ttl
      const result = await redis.set(key, lockValue, 'NX', 'PX', ttl);
      
      if (result === 'OK') {
        return true;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } catch (error) {
      structuredLogger.error(`[RedisLock] Error acquiring lock for ${key}:`, error);
      
      if (i === retries - 1) {
        throw error;
      }
    }
  }
  
  return false;
}

// Release lock safely (only if we own it)
async function releaseLock(key: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;
  
  try {
    const lockValue = await redis.get(key);
    if (lockValue) {
      const result = await redis.eval(script, 1, key, lockValue);
      return result === 1;
    }
    return false;
  } catch (error) {
    structuredLogger.error(`[RedisLock] Error releasing lock for ${key}:`, error);
    return false;
  }
}

export async function withLock<T>(
  resource: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const lockKey = `lock:${resource}`;
  
  // Try to acquire lock
  const acquired = await acquireLock(lockKey, ttl);
  
  if (!acquired) {
    structuredLogger.warn(`[RedisLock] Failed to acquire lock for ${resource} - already locked`);
    throw new Error(`Failed to acquire lock for ${resource}`);
  }
  
  structuredLogger.debug(`[RedisLock] Acquired lock for ${resource}`);
  
  try {
    // Execute the function
    const result = await fn();
    return result;
  } finally {
    // Always try to release the lock
    const released = await releaseLock(lockKey);
    if (released) {
      structuredLogger.debug(`[RedisLock] Released lock for ${resource}`);
    } else {
      structuredLogger.warn(`[RedisLock] Failed to release lock for ${resource}`);
    }
  }
}

// Cleanup on exit
process.on('exit', () => {
  redis.disconnect();
});
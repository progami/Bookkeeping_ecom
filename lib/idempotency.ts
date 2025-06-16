import crypto from 'crypto';
import { structuredLogger } from './logger';
import { redis } from './redis';

// Enhanced idempotency store with Redis support
const inMemoryStore = new Map<string, {
  response: any;
  timestamp: number;
}>();

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours in seconds for Redis
const MAX_KEYS = 10000;
let useRedis = false;

// Check Redis availability
async function checkRedisAvailability() {
  try {
    await redis.ping();
    useRedis = true;
    structuredLogger.info('Idempotency using Redis');
  } catch (error) {
    useRedis = false;
    structuredLogger.warn('Idempotency falling back to in-memory store', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Initialize Redis check
checkRedisAvailability();

// Cleanup old keys (only for in-memory store)
function cleanupIdempotencyKeys() {
  if (!useRedis) {
    const now = Date.now();
    const entries = Array.from(inMemoryStore.entries());
    
    // Remove expired keys
    for (const [key, data] of entries) {
      if (now - data.timestamp > IDEMPOTENCY_TTL) {
        inMemoryStore.delete(key);
      }
    }
    
    // Enforce size limit
    if (inMemoryStore.size > MAX_KEYS) {
      const sortedEntries = Array.from(inMemoryStore.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, inMemoryStore.size - MAX_KEYS);
      for (const [key] of toRemove) {
        inMemoryStore.delete(key);
      }
    }
  }
  // Redis handles TTL automatically
}

// Generate idempotency key from request data
export function generateIdempotencyKey(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Check if we have a cached response for this idempotency key
export async function getIdempotentResponse(key: string): Promise<any | null> {
  const redisKey = `idempotency:${key}`;
  
  if (useRedis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        structuredLogger.info('Idempotent request detected (Redis), returning cached response', {
          component: 'idempotency',
          key
        });
        return JSON.parse(cached);
      }
    } catch (error) {
      structuredLogger.error('Redis idempotency read error', error, {
        component: 'idempotency',
        key
      });
      useRedis = false;
    }
  }
  
  // In-memory fallback
  cleanupIdempotencyKeys();
  
  const cached = inMemoryStore.get(key);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
    structuredLogger.info('Idempotent request detected (in-memory), returning cached response', {
      component: 'idempotency',
      key
    });
    return cached.response;
  }
  
  return null;
}

// Store response for idempotency
export async function storeIdempotentResponse(key: string, response: any): Promise<void> {
  const redisKey = `idempotency:${key}`;
  
  if (useRedis) {
    try {
      await redis.setex(redisKey, IDEMPOTENCY_TTL_SECONDS, JSON.stringify(response));
      structuredLogger.debug('Stored idempotent response in Redis', {
        component: 'idempotency',
        key
      });
    } catch (error) {
      structuredLogger.error('Redis idempotency write error', error, {
        component: 'idempotency',
        key
      });
      useRedis = false;
    }
  }
  
  // Always store in memory as fallback
  inMemoryStore.set(key, {
    response,
    timestamp: Date.now()
  });
  
  structuredLogger.debug('Stored idempotent response in memory', {
    component: 'idempotency',
    key
  });
}

// Middleware wrapper for idempotent operations
export async function withIdempotency<T>(
  keyData: any,
  operation: () => Promise<T>
): Promise<T> {
  const key = generateIdempotencyKey(keyData);
  
  // Check for cached response
  const cached = await getIdempotentResponse(key);
  if (cached) {
    return cached;
  }
  
  // Execute operation
  const result = await operation();
  
  // Store result
  await storeIdempotentResponse(key, result);
  
  return result;
}

// Start background cleanup
setInterval(cleanupIdempotencyKeys, 60 * 60 * 1000); // Every hour
import crypto from 'crypto';
import { structuredLogger } from './logger';

// In-memory store for idempotency keys
// In production, use Redis with TTL
const idempotencyStore = new Map<string, {
  response: any;
  timestamp: number;
}>();

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_KEYS = 10000;

// Cleanup old keys
function cleanupIdempotencyKeys() {
  const now = Date.now();
  const entries = Array.from(idempotencyStore.entries());
  
  // Remove expired keys
  for (const [key, data] of entries) {
    if (now - data.timestamp > IDEMPOTENCY_TTL) {
      idempotencyStore.delete(key);
    }
  }
  
  // Enforce size limit
  if (idempotencyStore.size > MAX_KEYS) {
    const sortedEntries = Array.from(idempotencyStore.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedEntries.slice(0, idempotencyStore.size - MAX_KEYS);
    for (const [key] of toRemove) {
      idempotencyStore.delete(key);
    }
  }
}

// Generate idempotency key from request data
export function generateIdempotencyKey(data: any): string {
  const normalized = JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Check if we have a cached response for this idempotency key
export function getIdempotentResponse(key: string): any | null {
  cleanupIdempotencyKeys();
  
  const cached = idempotencyStore.get(key);
  if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
    structuredLogger.info('Idempotent request detected, returning cached response', {
      component: 'idempotency',
      key
    });
    return cached.response;
  }
  
  return null;
}

// Store response for idempotency
export function storeIdempotentResponse(key: string, response: any): void {
  idempotencyStore.set(key, {
    response,
    timestamp: Date.now()
  });
  
  structuredLogger.debug('Stored idempotent response', {
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
  const cached = getIdempotentResponse(key);
  if (cached) {
    return cached;
  }
  
  // Execute operation
  const result = await operation();
  
  // Store result
  storeIdempotentResponse(key, result);
  
  return result;
}

// Start background cleanup
setInterval(cleanupIdempotencyKeys, 60 * 60 * 1000); // Every hour
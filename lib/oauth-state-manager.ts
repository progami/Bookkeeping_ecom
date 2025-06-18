import crypto from 'crypto';
import { structuredLogger } from './logger';
import { redis } from './redis';

// Re-export generatePKCEPair from oauth-state.ts
export { generatePKCEPair } from './oauth-state';

const STATE_TTL = 10 * 60; // 10 minutes in seconds

/**
 * Store OAuth state data (PKCE verifier, return URL, etc.)
 */
export async function storeState(
  state: string,
  data: {
    codeVerifier: string;
    codeChallenge: string;
    returnUrl?: string;
  }
) {
  try {
    // Try Redis first if available
    if (redis) {
      await redis.setex(
        `oauth:state:${state}`,
        STATE_TTL,
        JSON.stringify({
          ...data,
          timestamp: Date.now()
        })
      );
      structuredLogger.debug('OAuth state stored in Redis', {
        state: state.substring(0, 10) + '...',
        hasReturnUrl: !!data.returnUrl
      });
      return;
    }
  } catch (error) {
    structuredLogger.warn('Failed to store state in Redis, using in-memory', { error });
  }

  // Fallback to in-memory storage (imported from oauth-state.ts)
  const { stateStore, cleanupStates } = await import('./oauth-state');
  
  // Clean up old states periodically
  cleanupStates();
  
  // Store in memory
  stateStore.set(state, {
    ...data,
    timestamp: Date.now()
  });
  
  structuredLogger.debug('OAuth state stored in memory', {
    state: state.substring(0, 10) + '...',
    hasReturnUrl: !!data.returnUrl
  });
}

/**
 * Retrieve OAuth state data
 */
export async function getState(state: string) {
  try {
    // Try Redis first if available
    if (redis) {
      const data = await redis.get(`oauth:state:${state}`);
      if (data) {
        structuredLogger.debug('OAuth state retrieved from Redis', {
          state: state.substring(0, 10) + '...'
        });
        return JSON.parse(data);
      }
    }
  } catch (error) {
    structuredLogger.warn('Failed to get state from Redis, checking in-memory', { error });
  }

  // Fallback to in-memory storage
  const { stateStore } = await import('./oauth-state');
  const data = stateStore.get(state);
  
  if (data) {
    structuredLogger.debug('OAuth state retrieved from memory', {
      state: state.substring(0, 10) + '...'
    });
    return data;
  }
  
  return null;
}

/**
 * Delete OAuth state data (after successful use)
 */
export async function deleteState(state: string) {
  try {
    // Try Redis first if available
    if (redis) {
      await redis.del(`oauth:state:${state}`);
      structuredLogger.debug('OAuth state deleted from Redis', {
        state: state.substring(0, 10) + '...'
      });
      return;
    }
  } catch (error) {
    structuredLogger.warn('Failed to delete state from Redis, removing from memory', { error });
  }

  // Fallback to in-memory storage
  const { stateStore } = await import('./oauth-state');
  stateStore.delete(state);
  
  structuredLogger.debug('OAuth state deleted from memory', {
    state: state.substring(0, 10) + '...'
  });
}
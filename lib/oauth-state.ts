import crypto from 'crypto';

// Store states in memory with size limit to prevent memory leaks
const MAX_STATES = 1000; // Maximum number of states to store
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

export const stateStore = new Map<string, { 
  timestamp: number;
  codeVerifier?: string;
  codeChallenge?: string;
}>();

// Clean up old states and enforce size limit
export function cleanupStates() {
  const now = Date.now();
  const entries = Array.from(stateStore.entries());
  
  // Remove expired states
  for (const [state, data] of entries) {
    if (now - data.timestamp > STATE_TTL) {
      stateStore.delete(state);
    }
  }
  
  // Enforce size limit - remove oldest states if over limit
  if (stateStore.size > MAX_STATES) {
    const sortedEntries = Array.from(stateStore.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = sortedEntries.slice(0, stateStore.size - MAX_STATES);
    for (const [state] of toRemove) {
      stateStore.delete(state);
    }
  }
}

// Background cleanup interval
let cleanupInterval: NodeJS.Timeout | null = null;

// Start background cleanup
export function startBackgroundCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupStates, 60 * 1000); // Run every minute
  }
}

// Stop background cleanup
export function stopBackgroundCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start cleanup when module loads
startBackgroundCleanup();

// Generate PKCE code verifier and challenge
export function generatePKCEPair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
}
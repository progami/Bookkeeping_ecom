// Store states in memory for development (in production, use Redis or similar)
export const stateStore = new Map<string, { timestamp: number }>();

// Clean up old states
export function cleanupStates() {
  const now = Date.now();
  const entries = Array.from(stateStore.entries());
  for (const [state, data] of entries) {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}
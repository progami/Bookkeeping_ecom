/**
 * Shared sync progress management module
 * Provides centralized progress tracking for sync operations
 */

// In-memory store for real-time progress updates
// In production, use Redis or similar
export const syncProgressStore = new Map<string, any>();

// Export function to update progress (called from sync route)
export function updateSyncProgress(syncId: string, progress: any) {
  syncProgressStore.set(syncId, {
    ...syncProgressStore.get(syncId),
    ...progress,
    lastUpdated: new Date()
  });
}

// Clear old progress entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [syncId, progress] of syncProgressStore.entries()) {
      if (progress.lastUpdated && now - progress.lastUpdated.getTime() > 3600000) { // 1 hour
        syncProgressStore.delete(syncId);
      }
    }
  }, 300000); // Every 5 minutes
}
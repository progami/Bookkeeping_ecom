/**
 * Token refresh lock mechanism to prevent race conditions
 * when multiple requests try to refresh the token simultaneously
 */

interface RefreshPromise {
  promise: Promise<any>;
  timestamp: number;
}

class TokenRefreshLock {
  private refreshPromises: Map<string, RefreshPromise> = new Map();
  private readonly LOCK_TIMEOUT = 30000; // 30 seconds timeout

  /**
   * Acquire a lock for token refresh
   * @param key Unique key for the token (e.g., user email or tenant ID)
   * @param refreshFn The function that performs the actual token refresh
   * @returns The refreshed token
   */
  async acquireRefreshLock<T>(
    key: string,
    refreshFn: () => Promise<T>
  ): Promise<T> {
    // Clean up old locks
    this.cleanupExpiredLocks();

    // Check if a refresh is already in progress
    const existingRefresh = this.refreshPromises.get(key);
    
    if (existingRefresh) {
      console.log(`[TokenRefreshLock] Waiting for existing refresh for key: ${key}`);
      try {
        // Wait for the existing refresh to complete
        return await existingRefresh.promise;
      } catch (error) {
        // If the existing refresh failed, we'll try again
        console.error(`[TokenRefreshLock] Existing refresh failed for key: ${key}`, error);
        this.refreshPromises.delete(key);
      }
    }

    // No existing refresh, create a new one
    console.log(`[TokenRefreshLock] Starting new refresh for key: ${key}`);
    
    const refreshPromise = refreshFn()
      .then((result) => {
        console.log(`[TokenRefreshLock] Refresh completed successfully for key: ${key}`);
        // Clean up after successful refresh
        this.refreshPromises.delete(key);
        return result;
      })
      .catch((error) => {
        console.error(`[TokenRefreshLock] Refresh failed for key: ${key}`, error);
        // Clean up after failed refresh
        this.refreshPromises.delete(key);
        throw error;
      });

    // Store the promise
    this.refreshPromises.set(key, {
      promise: refreshPromise,
      timestamp: Date.now()
    });

    return refreshPromise;
  }

  /**
   * Clean up expired locks to prevent memory leaks
   */
  private cleanupExpiredLocks() {
    const now = Date.now();
    
    for (const [key, refreshData] of this.refreshPromises.entries()) {
      if (now - refreshData.timestamp > this.LOCK_TIMEOUT) {
        console.warn(`[TokenRefreshLock] Cleaning up expired lock for key: ${key}`);
        this.refreshPromises.delete(key);
      }
    }
  }

  /**
   * Force clear all locks (useful for testing or cleanup)
   */
  clearAllLocks() {
    this.refreshPromises.clear();
  }
}

// Export singleton instance
export const tokenRefreshLock = new TokenRefreshLock();
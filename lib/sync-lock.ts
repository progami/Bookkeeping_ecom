/**
 * Application-level locking mechanism for sync operations
 * Prevents concurrent sync operations that could lead to data corruption
 */

import { structuredLogger as logger } from './logger';

interface Lock {
  id: string;
  acquiredAt: Date;
  expiresAt: Date;
  holder: string;
}

class SyncLockManager {
  private locks: Map<string, Lock> = new Map();
  private readonly DEFAULT_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval to remove expired locks
    this.startCleanup();
  }

  /**
   * Acquire a lock for a specific resource
   * @param resource The resource identifier (e.g., 'xero-sync', 'invoice-sync')
   * @param holder Identifier for who is holding the lock
   * @param timeout Optional timeout in milliseconds
   * @returns true if lock acquired, false otherwise
   */
  async acquireLock(
    resource: string, 
    holder: string, 
    timeout: number = this.DEFAULT_LOCK_TIMEOUT
  ): Promise<boolean> {
    const now = new Date();
    const existingLock = this.locks.get(resource);

    // Check if there's an existing lock
    if (existingLock) {
      // If lock hasn't expired, we can't acquire it
      if (existingLock.expiresAt > now) {
        logger.warn('Failed to acquire lock', {
          resource,
          holder,
          existingHolder: existingLock.holder,
          expiresIn: existingLock.expiresAt.getTime() - now.getTime()
        });
        return false;
      }
      
      // Lock has expired, we can remove it
      logger.info('Removing expired lock', {
        resource,
        expiredHolder: existingLock.holder,
        expiredAt: existingLock.expiresAt
      });
    }

    // Create new lock
    const lock: Lock = {
      id: `${resource}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      acquiredAt: now,
      expiresAt: new Date(now.getTime() + timeout),
      holder
    };

    this.locks.set(resource, lock);
    
    logger.info('Lock acquired', {
      resource,
      holder,
      lockId: lock.id,
      expiresAt: lock.expiresAt
    });

    return true;
  }

  /**
   * Release a lock
   * @param resource The resource identifier
   * @param holder The holder trying to release the lock
   * @returns true if lock was released, false if holder didn't own the lock
   */
  async releaseLock(resource: string, holder: string): Promise<boolean> {
    const lock = this.locks.get(resource);

    if (!lock) {
      logger.warn('Attempted to release non-existent lock', { resource, holder });
      return false;
    }

    if (lock.holder !== holder) {
      logger.warn('Attempted to release lock owned by another holder', {
        resource,
        attemptedBy: holder,
        actualHolder: lock.holder
      });
      return false;
    }

    this.locks.delete(resource);
    
    logger.info('Lock released', {
      resource,
      holder,
      lockId: lock.id,
      heldFor: new Date().getTime() - lock.acquiredAt.getTime()
    });

    return true;
  }

  /**
   * Check if a resource is locked
   * @param resource The resource identifier
   * @returns true if locked and not expired
   */
  isLocked(resource: string): boolean {
    const lock = this.locks.get(resource);
    if (!lock) return false;

    const now = new Date();
    if (lock.expiresAt <= now) {
      // Lock has expired, remove it
      this.locks.delete(resource);
      return false;
    }

    return true;
  }

  /**
   * Get lock information
   * @param resource The resource identifier
   * @returns Lock information or null
   */
  getLockInfo(resource: string): Lock | null {
    const lock = this.locks.get(resource);
    if (!lock) return null;

    const now = new Date();
    if (lock.expiresAt <= now) {
      // Lock has expired
      this.locks.delete(resource);
      return null;
    }

    return { ...lock };
  }

  /**
   * Extend a lock's expiration time
   * @param resource The resource identifier
   * @param holder The holder trying to extend the lock
   * @param additionalTime Additional time in milliseconds
   * @returns true if extended, false otherwise
   */
  async extendLock(
    resource: string, 
    holder: string, 
    additionalTime: number = this.DEFAULT_LOCK_TIMEOUT
  ): Promise<boolean> {
    const lock = this.locks.get(resource);

    if (!lock) {
      logger.warn('Attempted to extend non-existent lock', { resource, holder });
      return false;
    }

    if (lock.holder !== holder) {
      logger.warn('Attempted to extend lock owned by another holder', {
        resource,
        attemptedBy: holder,
        actualHolder: lock.holder
      });
      return false;
    }

    const now = new Date();
    if (lock.expiresAt <= now) {
      logger.warn('Attempted to extend expired lock', {
        resource,
        holder,
        expiredAt: lock.expiresAt
      });
      return false;
    }

    // Extend the lock
    lock.expiresAt = new Date(lock.expiresAt.getTime() + additionalTime);
    
    logger.info('Lock extended', {
      resource,
      holder,
      newExpiresAt: lock.expiresAt,
      extendedBy: additionalTime
    });

    return true;
  }

  /**
   * Clean up expired locks
   */
  private cleanup(): void {
    const now = new Date();
    const expiredLocks: string[] = [];

    this.locks.forEach((lock, resource) => {
      if (lock.expiresAt <= now) {
        expiredLocks.push(resource);
      }
    });

    expiredLocks.forEach(resource => {
      const lock = this.locks.get(resource);
      if (lock) {
        logger.info('Cleaning up expired lock', {
          resource,
          holder: lock.holder,
          expiredAt: lock.expiresAt
        });
        this.locks.delete(resource);
      }
    });

    if (expiredLocks.length > 0) {
      logger.info(`Cleaned up ${expiredLocks.length} expired locks`);
    }
  }

  /**
   * Start the cleanup interval
   */
  private startCleanup(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Stop the cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all active locks (for debugging/monitoring)
   */
  getAllLocks(): Map<string, Lock> {
    const now = new Date();
    const activeLocks = new Map<string, Lock>();

    this.locks.forEach((lock, resource) => {
      if (lock.expiresAt > now) {
        activeLocks.set(resource, { ...lock });
      }
    });

    return activeLocks;
  }

  /**
   * Clear all locks (use with caution!)
   */
  clearAllLocks(): void {
    const count = this.locks.size;
    this.locks.clear();
    logger.warn(`Cleared all ${count} locks`);
  }
}

// Export singleton instance
export const syncLock = new SyncLockManager();

// Helper function for using locks with automatic cleanup
export async function withLock<T>(
  resource: string,
  holder: string,
  operation: () => Promise<T>,
  options?: {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  }
): Promise<T> {
  const { 
    timeout = 5 * 60 * 1000, 
    retries = 0, 
    retryDelay = 1000 
  } = options || {};

  let attempt = 0;
  
  while (attempt <= retries) {
    const acquired = await syncLock.acquireLock(resource, holder, timeout);
    
    if (acquired) {
      try {
        logger.info('Executing operation with lock', { resource, holder });
        const result = await operation();
        return result;
      } finally {
        await syncLock.releaseLock(resource, holder);
      }
    }
    
    attempt++;
    
    if (attempt <= retries) {
      logger.info(`Lock acquisition failed, retrying in ${retryDelay}ms`, {
        resource,
        holder,
        attempt,
        maxRetries: retries
      });
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw new Error(`Failed to acquire lock for ${resource} after ${retries + 1} attempts`);
}

// Lock resource identifiers
export const LOCK_RESOURCES = {
  XERO_SYNC: 'xero-sync',
  XERO_TOKEN_REFRESH: 'xero-token-refresh',
  INVOICE_SYNC: 'invoice-sync',
  BILL_SYNC: 'bill-sync',
  ACCOUNT_SYNC: 'account-sync',
  TRANSACTION_SYNC: 'transaction-sync',
  FULL_SYNC: 'full-sync',
  CASHFLOW_SYNC: 'cashflow-sync',
  DATABASE_MIGRATION: 'database-migration'
} as const;

export type LockResource = typeof LOCK_RESOURCES[keyof typeof LOCK_RESOURCES];
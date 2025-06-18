/**
 * Database configuration and optimization for SQLite
 * Handles concurrent access and performance tuning
 */

import { prisma } from './prisma';
import { structuredLogger as logger } from './logger';

class DatabaseConfig {
  private isConfigured = false;
  private configPromise: Promise<void> | null = null;
  
  /**
   * Configure database for optimal performance
   */
  async configure(): Promise<void> {
    // Use global flag to ensure configuration only happens once per process
    const globalAny = global as any;
    if (globalAny.__databaseConfigComplete) {
      return;
    }
    
    // Ensure configuration only happens once
    if (this.isConfigured) {
      return;
    }
    
    if (this.configPromise) {
      return this.configPromise;
    }
    
    this.configPromise = this.performConfiguration();
    await this.configPromise;
    this.isConfigured = true;
    globalAny.__databaseConfigComplete = true;
  }
  
  private async performConfiguration(): Promise<void> {
    try {
      // These pragmas improve SQLite performance and concurrency
      const pragmas = [
        // Use memory for temp storage (faster)
        'PRAGMA temp_store = MEMORY',
        // Increase cache size (default is 2000 pages)
        'PRAGMA cache_size = 10000',
        // Use memory mapped I/O for better performance
        'PRAGMA mmap_size = 30000000000',
        // Synchronous NORMAL is faster than FULL but still safe
        'PRAGMA synchronous = NORMAL',
        // Page size optimization
        'PRAGMA page_size = 4096',
        // Auto vacuum to prevent database bloat
        'PRAGMA auto_vacuum = INCREMENTAL'
      ];
      
      // Apply pragmas one by one
      for (const pragma of pragmas) {
        try {
          // Skip mmap_size as it returns results in SQLite
          if (pragma.includes('mmap_size')) {
            continue;
          }
          await prisma.$executeRawUnsafe(pragma);
          // Only log in debug mode to reduce noise
          if (process.env.LOG_LEVEL === 'debug') {
            logger.debug(`Applied database optimization: ${pragma}`);
          }
        } catch (error) {
          // Only log actual errors, not expected SQLite behavior
          if (!error || !(error as any).message?.includes('Execute returned results')) {
            logger.warn(`Failed to apply pragma: ${pragma}`, { error });
          }
        }
      }
      
      // Run PRAGMA optimize (returns results, so use queryRawUnsafe)
      try {
        await prisma.$queryRawUnsafe('PRAGMA optimize');
        if (process.env.LOG_LEVEL === 'debug') {
          logger.debug('Applied database optimization: PRAGMA optimize');
        }
      } catch (error) {
        logger.warn('Failed to apply PRAGMA optimize', { error });
      }
      
      // Try to enable WAL mode (might fail if database is busy)
      try {
        // Use queryRawUnsafe for PRAGMA that returns results
        await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
        if (process.env.LOG_LEVEL === 'debug') {
          logger.info('Database configured with WAL mode for better concurrency');
        }
      } catch (error) {
        logger.warn('Could not enable WAL mode, using default journal mode', { error });
      }
      
      // Set a reasonable busy timeout
      try {
        // Use queryRawUnsafe for PRAGMA that returns results
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000');
        if (process.env.LOG_LEVEL === 'debug') {
          logger.info('Database configured with 5 second busy timeout');
        }
      } catch (error) {
        logger.warn('Could not set busy timeout', { error });
      }
      
    } catch (error) {
      logger.error('Database configuration failed', error as Error);
      // Don't throw - allow the app to continue with default settings
    }
  }
  
  /**
   * Run database optimization (call periodically)
   */
  async optimize(): Promise<void> {
    try {
      // PRAGMA optimize returns results, use queryRawUnsafe
      await prisma.$queryRawUnsafe('PRAGMA optimize');
      // PRAGMA incremental_vacuum doesn't return results, use executeRawUnsafe
      await prisma.$executeRawUnsafe('PRAGMA incremental_vacuum');
      logger.debug('Database optimization completed');
    } catch (error) {
      logger.warn('Database optimization failed', { error });
    }
  }
}

// Export singleton instance
export const databaseConfig = new DatabaseConfig();

// Configure database when module loads (if not in edge runtime)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // Use a global flag to ensure we only configure once per process
  const globalAny = global as any;
  if (!globalAny.__databaseConfigured) {
    globalAny.__databaseConfigured = true;
    databaseConfig.configure().catch(error => {
      logger.error('Initial database configuration failed', error);
    });
  }
}
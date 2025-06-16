import { structuredLogger } from './logger';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  rssMB: number;
  percentUsed: number;
}

class MemoryMonitor {
  private highMemoryThreshold = 0.8; // 80% heap usage
  private criticalMemoryThreshold = 0.9; // 90% heap usage
  private checkInterval = 60000; // Check every minute
  private intervalId: NodeJS.Timeout | null = null;

  private formatBytes(bytes: number): number {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  getMemoryStats(): MemoryStats {
    const usage = process.memoryUsage();
    
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      heapUsedMB: this.formatBytes(usage.heapUsed),
      heapTotalMB: this.formatBytes(usage.heapTotal),
      externalMB: this.formatBytes(usage.external),
      rssMB: this.formatBytes(usage.rss),
      percentUsed: usage.heapUsed / usage.heapTotal
    };
  }

  logMemoryUsage(context?: string): void {
    const stats = this.getMemoryStats();
    
    structuredLogger.info('Memory usage', {
      component: 'memory-monitor',
      context,
      ...stats
    });

    // Check for high memory usage
    if (stats.percentUsed > this.criticalMemoryThreshold) {
      structuredLogger.error('Critical memory usage detected', new Error('Memory usage critical'), {
        component: 'memory-monitor',
        context,
        percentUsed: Math.round(stats.percentUsed * 100),
        heapUsedMB: stats.heapUsedMB,
        heapTotalMB: stats.heapTotalMB
      });
    } else if (stats.percentUsed > this.highMemoryThreshold) {
      structuredLogger.warn('High memory usage detected', {
        component: 'memory-monitor',
        context,
        percentUsed: Math.round(stats.percentUsed * 100),
        heapUsedMB: stats.heapUsedMB,
        heapTotalMB: stats.heapTotalMB
      });
    }
  }

  startMonitoring(): void {
    if (this.intervalId) {
      return; // Already monitoring
    }

    // Initial check
    this.logMemoryUsage('monitoring-start');

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.logMemoryUsage('periodic-check');
    }, this.checkInterval);

    // Ensure cleanup on process exit
    process.on('exit', () => this.stopMonitoring());
    process.on('SIGINT', () => this.stopMonitoring());
    process.on('SIGTERM', () => this.stopMonitoring());
  }

  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logMemoryUsage('monitoring-stop');
    }
  }

  // Helper to monitor a specific operation
  async monitorOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const beforeStats = this.getMemoryStats();
    
    try {
      const result = await operation();
      
      const afterStats = this.getMemoryStats();
      const memoryDelta = afterStats.heapUsed - beforeStats.heapUsed;
      const memoryDeltaMB = this.formatBytes(memoryDelta);
      
      structuredLogger.info('Operation memory impact', {
        component: 'memory-monitor',
        operation: operationName,
        memoryDeltaMB,
        beforeHeapUsedMB: beforeStats.heapUsedMB,
        afterHeapUsedMB: afterStats.heapUsedMB,
        duration: Date.now()
      });
      
      // Force garbage collection if memory increased significantly (> 50MB)
      if (memoryDelta > 50 * 1024 * 1024 && global.gc) {
        global.gc();
        const gcStats = this.getMemoryStats();
        structuredLogger.info('Garbage collection triggered', {
          component: 'memory-monitor',
          operation: operationName,
          beforeGcMB: afterStats.heapUsedMB,
          afterGcMB: gcStats.heapUsedMB,
          freedMB: this.formatBytes(afterStats.heapUsed - gcStats.heapUsed)
        });
      }
      
      return result;
    } catch (error) {
      structuredLogger.error('Operation failed', error as Error, {
        component: 'memory-monitor',
        operation: operationName,
        memoryAtFailure: this.getMemoryStats()
      });
      throw error;
    }
  }
}

// Export singleton instance
export const memoryMonitor = new MemoryMonitor();

// Start monitoring if in production
if (process.env.NODE_ENV === 'production') {
  memoryMonitor.startMonitoring();
}
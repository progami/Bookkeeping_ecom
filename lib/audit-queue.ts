/**
 * Audit Queue for batch processing audit logs
 * Implements a simple in-memory queue with batch processing
 */

import { structuredLogger as logger } from './logger';

interface QueueItem {
  data: any;
  timestamp: number;
  retries: number;
}

class AuditQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor() {
    this.startBatchProcessor();
  }

  add(data: any) {
    this.queue.push({
      data,
      timestamp: Date.now(),
      retries: 0
    });

    // Process immediately if queue is getting large
    if (this.queue.length >= this.batchSize * 2) {
      this.processBatch();
    }
  }

  private startBatchProcessor() {
    this.intervalHandle = setInterval(() => {
      this.processBatch();
    }, this.flushInterval);
  }

  private async processBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Take a batch from the queue
      const batch = this.queue.splice(0, this.batchSize);
      
      // Process the batch
      for (const item of batch) {
        try {
          // Process individual item
          logger.debug('[AuditQueue] Processing audit log item', {
            timestamp: item.timestamp,
            data: item.data
          });
          
          // Here you would normally persist to database or send to service
          // For now just log it
        } catch (error) {
          logger.error('[AuditQueue] Failed to process audit item', error);
          
          // Retry logic
          if (item.retries < 3) {
            item.retries++;
            this.queue.push(item);
          }
        }
      }
    } catch (error) {
      logger.error('[AuditQueue] Batch processing error', error);
    } finally {
      this.processing = false;
    }
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    
    // Process remaining items
    this.processBatch();
  }

  getQueueSize() {
    return this.queue.length;
  }
}

// Export singleton instance
export const auditQueue = new AuditQueue();

// Cleanup on exit
process.on('exit', () => {
  auditQueue.stop();
});
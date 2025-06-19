import { Worker } from 'bullmq';
import { structuredLogger } from '@/lib/logger';
import createWebhookProcessor from './webhook-processor';

// Store active workers
const workers: Map<string, Worker> = new Map();

/**
 * Start all queue workers
 */
export async function startWorkers() {
  structuredLogger.info('Starting queue workers', {
    component: 'queue-workers'
  });

  try {
    // Start webhook processor
    const webhookWorker = createWebhookProcessor();
    workers.set('webhook-processor', webhookWorker);

    // Start historical sync processor
    const { historicalSyncWorker } = await import('../processors/xero-historical-sync.processor');
    workers.set('historical-sync', historicalSyncWorker);

    structuredLogger.info('Queue workers started', {
      component: 'queue-workers',
      workers: Array.from(workers.keys())
    });
  } catch (error) {
    structuredLogger.error('Failed to start queue workers', error as Error, {
      component: 'queue-workers'
    });
    throw error;
  }
}

/**
 * Stop all queue workers gracefully
 */
export async function stopWorkers() {
  structuredLogger.info('Stopping queue workers', {
    component: 'queue-workers'
  });

  const stopPromises = Array.from(workers.entries()).map(async ([name, worker]) => {
    try {
      await worker.close();
      structuredLogger.info('Worker stopped', {
        component: 'queue-workers',
        worker: name
      });
    } catch (error) {
      structuredLogger.error('Failed to stop worker', error as Error, {
        component: 'queue-workers',
        worker: name
      });
    }
  });

  await Promise.all(stopPromises);
  workers.clear();

  structuredLogger.info('All queue workers stopped', {
    component: 'queue-workers'
  });
}

/**
 * Get worker status
 */
export function getWorkerStatus(): Record<string, any> {
  const status: Record<string, any> = {};

  workers.forEach((worker, name) => {
    status[name] = {
      isRunning: worker.isRunning(),
      isPaused: worker.isPaused(),
      concurrency: worker.concurrency
    };
  });

  return status;
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  structuredLogger.info('SIGTERM received, stopping workers', {
    component: 'queue-workers'
  });
  await stopWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  structuredLogger.info('SIGINT received, stopping workers', {
    component: 'queue-workers'
  });
  await stopWorkers();
  process.exit(0);
});
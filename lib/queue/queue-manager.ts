import { Worker } from 'bullmq';
import { createXeroSyncWorker } from './processors/xero-sync.processor';
import { createEmailNotificationWorker } from './processors/email-notification.processor';
import { createReportGenerationWorker } from './processors/report-generation.processor';
import { structuredLogger } from '@/lib/logger';
import { closeQueues, createQueueMonitor, QUEUE_NAMES } from './queue-config';

class QueueManager {
  private workers: Map<string, Worker> = new Map();
  private monitors: Map<string, any> = new Map();
  private isStarted = false;

  async start() {
    if (this.isStarted) {
      structuredLogger.warn('Queue manager already started', {
        component: 'queue-manager'
      });
      return;
    }

    try {
      structuredLogger.info('Starting queue manager', {
        component: 'queue-manager'
      });

      // Start workers
      this.workers.set('xero-sync', createXeroSyncWorker());
      this.workers.set('email-notifications', createEmailNotificationWorker());
      this.workers.set('report-generation', createReportGenerationWorker());

      // Start queue monitors
      Object.values(QUEUE_NAMES).forEach(queueName => {
        this.monitors.set(queueName, createQueueMonitor(queueName));
      });

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      this.isStarted = true;

      structuredLogger.info('Queue manager started successfully', {
        component: 'queue-manager',
        workers: Array.from(this.workers.keys()),
        monitors: Array.from(this.monitors.keys())
      });
    } catch (error) {
      structuredLogger.error('Failed to start queue manager', error, {
        component: 'queue-manager'
      });
      throw error;
    }
  }

  async stop() {
    if (!this.isStarted) {
      return;
    }

    structuredLogger.info('Stopping queue manager', {
      component: 'queue-manager'
    });

    try {
      // Stop all workers
      const stopPromises = Array.from(this.workers.values()).map(worker => 
        worker.close()
      );

      // Stop all monitors
      const monitorStopPromises = Array.from(this.monitors.values()).map(monitor =>
        monitor.close()
      );

      await Promise.all([...stopPromises, ...monitorStopPromises]);

      // Close queue connections
      await closeQueues();

      this.workers.clear();
      this.monitors.clear();
      this.isStarted = false;

      structuredLogger.info('Queue manager stopped successfully', {
        component: 'queue-manager'
      });
    } catch (error) {
      structuredLogger.error('Error stopping queue manager', error, {
        component: 'queue-manager'
      });
      throw error;
    }
  }

  private setupGracefulShutdown() {
    const shutdown = async (signal: string) => {
      structuredLogger.info(`Received ${signal}, shutting down gracefully`, {
        component: 'queue-manager'
      });

      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  getWorkerStatus() {
    const status: Record<string, any> = {};

    this.workers.forEach((worker, name) => {
      status[name] = {
        running: worker.isRunning(),
        paused: worker.isPaused(),
        closing: worker.closing
      };
    });

    return status;
  }

  async pauseWorker(name: string) {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker ${name} not found`);
    }

    await worker.pause();
    structuredLogger.info(`Worker ${name} paused`, {
      component: 'queue-manager'
    });
  }

  async resumeWorker(name: string) {
    const worker = this.workers.get(name);
    if (!worker) {
      throw new Error(`Worker ${name} not found`);
    }

    await worker.resume();
    structuredLogger.info(`Worker ${name} resumed`, {
      component: 'queue-manager'
    });
  }
}

// Singleton instance
export const queueManager = new QueueManager();
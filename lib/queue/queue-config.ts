import { Queue, Worker, QueueEvents, ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';
import { structuredLogger } from '@/lib/logger';

// Redis connection configuration
const redisConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '1'), // Use different DB for queues
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

// Create Redis connections for BullMQ
export const createRedisConnection = () => new Redis(redisConfig);

// Queue definitions
export const QUEUE_NAMES = {
  XERO_SYNC: 'xero-sync',
  EMAIL_NOTIFICATIONS: 'email-notifications',
  REPORT_GENERATION: 'report-generation',
  DATA_EXPORT: 'data-export',
  WEBHOOK_PROCESSING: 'webhook-processing'
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job types
export interface XeroSyncJob {
  userId: string;
  tenantId: string;
  syncType: 'full' | 'incremental' | 'transactions' | 'invoices' | 'contacts';
  options?: {
    startDate?: string;
    endDate?: string;
    forceUpdate?: boolean;
  };
}

export interface EmailNotificationJob {
  to: string;
  subject: string;
  template: 'sync-complete' | 'error-alert' | 'report-ready' | 'welcome';
  data: Record<string, any>;
}

export interface ReportGenerationJob {
  userId: string;
  reportType: 'profit-loss' | 'balance-sheet' | 'cash-flow' | 'tax-summary';
  period: {
    startDate: string;
    endDate: string;
  };
  format: 'pdf' | 'excel' | 'csv';
  options?: Record<string, any>;
}

export interface DataExportJob {
  userId: string;
  exportType: 'transactions' | 'invoices' | 'contacts' | 'full-backup';
  format: 'csv' | 'json' | 'excel';
  filters?: Record<string, any>;
}

export interface WebhookProcessingJob {
  webhookId: string;
  eventType: string;
  payload: any;
  retryCount?: number;
}

// Job options
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000
  },
  removeOnComplete: {
    age: 3600, // 1 hour
    count: 100
  },
  removeOnFail: {
    age: 24 * 3600 // 24 hours
  }
};

// Priority levels
export const PRIORITY_LEVELS = {
  CRITICAL: 1,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20
} as const;

// Create queue instances
const queues: Map<QueueName, Queue> = new Map();

export function getQueue<T = any>(queueName: QueueName): Queue<T> {
  if (!queues.has(queueName)) {
    const queue = new Queue<T>(queueName, {
      connection: createRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS
    });

    queue.on('error', (error) => {
      structuredLogger.error('Queue error', error, {
        component: 'job-queue',
        queue: queueName
      });
    });

    queues.set(queueName, queue);
  }

  return queues.get(queueName) as Queue<T>;
}

// Queue event monitoring
export function createQueueMonitor(queueName: QueueName): QueueEvents {
  const queueEvents = new QueueEvents(queueName, {
    connection: createRedisConnection()
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    structuredLogger.info('Job completed', {
      component: 'job-queue',
      queue: queueName,
      jobId,
      result: returnvalue
    });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    structuredLogger.error('Job failed', new Error(failedReason), {
      component: 'job-queue',
      queue: queueName,
      jobId
    });
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    structuredLogger.info('Job progress', {
      component: 'job-queue',
      queue: queueName,
      jobId,
      progress: data
    });
  });

  return queueEvents;
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map(queue => queue.close());
  await Promise.all(closePromises);
  queues.clear();
}

// Queue health check
export async function checkQueueHealth(): Promise<{
  healthy: boolean;
  queues: Record<string, any>;
}> {
  const health: Record<string, any> = {};
  let healthy = true;

  for (const [name, queue] of queues.entries()) {
    try {
      const isPaused = await queue.isPaused();
      const jobCounts = await queue.getJobCounts();
      const workers = await queue.getWorkers();

      health[name] = {
        status: isPaused ? 'paused' : 'active',
        jobs: jobCounts,
        workers: workers.length,
        healthy: true
      };
    } catch (error) {
      healthy = false;
      health[name] = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        healthy: false
      };
    }
  }

  return { healthy, queues: health };
}
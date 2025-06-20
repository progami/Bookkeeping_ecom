/**
 * Shared sync progress management module
 * Provides centralized progress tracking for sync operations
 * Uses Redis for persistence across server instances
 */

import { structuredLogger } from '@/lib/logger';
import Redis from 'ioredis';

const PROGRESS_TTL_SECONDS = 3600; // 1 hour
const PROGRESS_KEY_PREFIX = 'sync_progress:';

// Create a Redis client WITHOUT the prefix for sync progress
// This is needed because the sync progress keys are stored without prefix
function createSyncRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  return redisUrl ? new Redis(redisUrl) : new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    // NO keyPrefix - sync progress is stored without prefix
  });
}

export interface SyncProgress {
  syncId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  percentage: number;
  currentStep: string;
  steps: {
    [key: string]: {
      status: 'pending' | 'in_progress' | 'completed';
      count?: number;
      details?: string; // Added per architect's recommendation
      error?: string;
    }
  };
  error?: string;
  startedAt: string;
  lastUpdated: string;
  completedAt?: string;
  checkpoint?: {
    restoredFrom?: string;
    lastSaved?: string;
    completedEntities?: string[];
  };
}

// Export function to update progress (called from sync route)
export async function updateSyncProgress(syncId: string, progress: Partial<SyncProgress>) {
  const redis = createSyncRedisClient();
  try {
    const key = `${PROGRESS_KEY_PREFIX}${syncId}`;
    const currentProgress = await getSyncProgress(syncId) || {
      syncId,
      status: 'pending',
      percentage: 0,
      currentStep: 'Initializing...',
      steps: {},
      startedAt: new Date().toISOString()
    };
    
    const newProgress: SyncProgress = {
      ...currentProgress,
      ...progress,
      lastUpdated: new Date().toISOString()
    };
    
    await redis.setex(key, PROGRESS_TTL_SECONDS, JSON.stringify(newProgress));
    
    structuredLogger.info('Sync progress updated', {
      syncId,
      status: newProgress.status,
      percentage: newProgress.percentage,
      currentStep: newProgress.currentStep,
      key, // Log the actual key being used
      steps: newProgress.steps
    });
  } catch (error) {
    structuredLogger.error('Failed to update sync progress', error, {
      syncId,
      component: 'sync-progress-manager'
    });
    // Don't throw - allow sync to continue even if progress tracking fails
  } finally {
    await redis.quit();
  }
}

// Export function to get progress (called from progress endpoint)
export async function getSyncProgress(syncId: string): Promise<SyncProgress | null> {
  const redis = createSyncRedisClient();
  try {
    const key = `${PROGRESS_KEY_PREFIX}${syncId}`;
    const data = await redis.get(key);
    
    structuredLogger.info('Getting sync progress', {
      syncId,
      key,
      hasData: !!data,
      dataLength: data?.length
    });
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data) as SyncProgress;
  } catch (error) {
    structuredLogger.error('Failed to get sync progress', error, {
      syncId,
      component: 'sync-progress-manager'
    });
    return null;
  } finally {
    await redis.quit();
  }
}

// Helper to mark sync as completed
export async function completeSyncProgress(syncId: string, summary?: any) {
  await updateSyncProgress(syncId, {
    status: 'completed',
    percentage: 100,
    currentStep: 'Sync completed successfully',
    completedAt: new Date().toISOString(),
    ...(summary && { steps: { summary: { status: 'completed', details: JSON.stringify(summary) } } })
  });
}

// Helper to mark sync as failed
export async function failSyncProgress(syncId: string, error: string) {
  await updateSyncProgress(syncId, {
    status: 'failed',
    currentStep: 'Sync failed',
    error,
    completedAt: new Date().toISOString()
  });
}
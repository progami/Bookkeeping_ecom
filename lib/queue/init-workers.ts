import { structuredLogger } from '@/lib/logger';

let workersInitialized = false;

export async function initializeQueueWorkers() {
  // Only initialize on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  if (workersInitialized) {
    return;
  }

  try {
    const { startWorkers } = await import('./workers');
    await startWorkers();
    workersInitialized = true;
    structuredLogger.info('[Queue Init] Queue workers initialized');
  } catch (error) {
    structuredLogger.error('[Queue Init] Failed to initialize queue workers', error);
  }
}

// Initialize workers when this module is imported
if (typeof window === 'undefined') {
  initializeQueueWorkers();
}
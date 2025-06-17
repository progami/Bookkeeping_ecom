'use client';

import { useSync } from '@/contexts/SyncContext';
import { useCallback } from 'react';

interface UseXeroDataOptions {
  onSyncRequired?: () => void;
  onSyncFailed?: (error: any) => void;
}

export function useXeroData(options: UseXeroDataOptions = {}) {
  const { syncStatus, canUseXeroData, syncWithXero } = useSync();

  const fetchXeroData = useCallback(async (
    fetcher: () => Promise<any>,
    fallbackData?: any
  ) => {
    // If sync hasn't happened or failed, don't make Xero API calls
    if (!canUseXeroData) {
      if (syncStatus.status === 'idle') {
        // Trigger sync if not done yet
        if (options.onSyncRequired) {
          options.onSyncRequired();
        }
        await syncWithXero();
        return fallbackData || null;
      }
      
      if (syncStatus.status === 'failed') {
        if (options.onSyncFailed) {
          options.onSyncFailed(syncStatus.error);
        }
        return fallbackData || null;
      }

      // Still syncing
      return fallbackData || null;
    }

    // Sync was successful, proceed with the fetch
    try {
      return await fetcher();
    } catch (error) {
      console.error('Error fetching Xero data:', error);
      return fallbackData || null;
    }
  }, [canUseXeroData, syncStatus, syncWithXero, options]);

  return {
    fetchXeroData,
    canUseXeroData,
    syncStatus,
    isLoading: syncStatus.status === 'syncing',
    hasError: syncStatus.status === 'failed'
  };
}
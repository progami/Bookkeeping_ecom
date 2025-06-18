'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';
import toast from 'react-hot-toast';

interface UseXeroDataOptions {
  onDataRequired?: () => void;
  onFetchFailed?: (error: any) => void;
}

export function useXeroData(options: UseXeroDataOptions = {}) {
  const { hasData, isLoading: authIsLoading } = useAuth();

  const fetchXeroData = useCallback(async <T>(
    fetcher: () => Promise<T>,
    fallbackData?: T
  ): Promise<T | null> => {
    // If auth is still loading or if there's no data in the local DB, return the fallback.
    // The UI component is now responsible for handling the "no data" state.
    if (authIsLoading || !hasData) {
      if (!hasData && options.onDataRequired) {
        options.onDataRequired();
      }
      return fallbackData || null;
    }

    // If we have data, proceed with fetching it from our internal API.
    try {
      return await fetcher();
    } catch (error) {
      console.error('Error fetching local data:', error);
      if (options.onFetchFailed) {
        options.onFetchFailed(error);
      }
      return fallbackData || null;
    }
  }, [hasData, authIsLoading, options]);

  return {
    fetchXeroData,
    canFetchData: hasData && !authIsLoading,
    isLoading: authIsLoading,
    hasError: !hasData && !authIsLoading, // Represents a state where data is expected but missing.
  };
}
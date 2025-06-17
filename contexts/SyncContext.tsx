'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from './AuthContext';

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'success' | 'failed';
  lastSyncAt?: Date;
  error?: {
    message: string;
    code?: string;
    retryable?: boolean;
  };
  data?: {
    recordsCreated?: number;
    recordsUpdated?: number;
    syncDuration?: number;
  };
}

interface SyncContextType {
  syncStatus: SyncStatus;
  syncWithXero: () => Promise<void>;
  clearSyncError: () => void;
  canUseXeroData: boolean;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasXeroConnection } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: 'idle'
  });

  // Check if we can use Xero data (successfully synced)
  const canUseXeroData = syncStatus.status === 'success';

  // Load sync status from localStorage
  useEffect(() => {
    if (isAuthenticated && hasXeroConnection) {
      const savedStatus = localStorage.getItem('xero_sync_status');
      if (savedStatus) {
        const parsed = JSON.parse(savedStatus);
        // Check if sync is still valid (less than 1 hour old)
        if (parsed.lastSyncAt) {
          const lastSync = new Date(parsed.lastSyncAt);
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (lastSync > hourAgo && parsed.status === 'success') {
            setSyncStatus(parsed);
            return;
          }
        }
      }
      // Otherwise, we need to sync
      setSyncStatus({ status: 'idle' });
    }
  }, [isAuthenticated, hasXeroConnection]);

  const syncWithXero = async () => {
    // Don't sync if already syncing
    if (syncStatus.status === 'syncing') {
      return;
    }

    setSyncStatus({ status: 'syncing' });

    try {
      const response = await apiClient.post('/api/v1/xero/sync', {
        forceSync: false,
        syncOptions: {
          entities: ['accounts', 'transactions', 'invoices', 'bills', 'contacts']
        }
      });

      if (response.error) {
        const error = {
          message: response.error.message || 'Sync failed',
          code: response.error.code,
          retryable: response.error.code !== 'RATE_LIMITED'
        };

        const newStatus: SyncStatus = {
          status: 'failed',
          error
        };

        setSyncStatus(newStatus);
        localStorage.setItem('xero_sync_status', JSON.stringify(newStatus));
        return;
      }

      const newStatus: SyncStatus = {
        status: 'success',
        lastSyncAt: new Date(),
        data: {
          recordsCreated: response.data?.recordsCreated,
          recordsUpdated: response.data?.recordsUpdated,
          syncDuration: response.data?.duration
        }
      };

      setSyncStatus(newStatus);
      localStorage.setItem('xero_sync_status', JSON.stringify(newStatus));
    } catch (error: any) {
      const newStatus: SyncStatus = {
        status: 'failed',
        error: {
          message: error.message || 'Network error',
          retryable: true
        }
      };

      setSyncStatus(newStatus);
      localStorage.setItem('xero_sync_status', JSON.stringify(newStatus));
    }
  };

  const clearSyncError = () => {
    setSyncStatus({ status: 'idle' });
    localStorage.removeItem('xero_sync_status');
  };

  return (
    <SyncContext.Provider
      value={{
        syncStatus,
        syncWithXero,
        clearSyncError,
        canUseXeroData
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
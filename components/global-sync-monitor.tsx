'use client';

import React, { useEffect, useState } from 'react';
import { EnhancedSyncStatus } from './sync-status-enhanced';
import { useGlobalSync } from '@/contexts/GlobalSyncContext';
import { useSync } from '@/contexts/SyncContext';

export function GlobalSyncMonitor() {
  const { activeSyncId, setActiveSyncId } = useGlobalSync();
  const { syncStatus } = useSync();
  const [localSyncId, setLocalSyncId] = useState<string | null>(null);
  const [isCheckingSync, setIsCheckingSync] = useState(false);

  // Check for active sync ID in localStorage on mount
  useEffect(() => {
    const checkForActiveSync = async () => {
      setIsCheckingSync(true);
      const storedSyncId = localStorage.getItem('active_sync_id');
      
      if (storedSyncId) {
        // Verify the sync is still active by checking its status
        try {
          const response = await fetch(`/api/v1/xero/sync/progress/${storedSyncId}`);
          const data = await response.json();
          
          if (response.ok && data && (data.status === 'in_progress' || data.status === 'pending')) {
            // Sync is still active, restore it
            setLocalSyncId(storedSyncId);
            setActiveSyncId(storedSyncId);
          } else {
            // Sync is no longer active, clear it
            localStorage.removeItem('active_sync_id');
            setLocalSyncId(null);
            setActiveSyncId(null);
          }
        } catch (error) {
          console.error('Failed to check sync status:', error);
          // On error, clear the sync ID
          localStorage.removeItem('active_sync_id');
          setLocalSyncId(null);
          setActiveSyncId(null);
        }
      }
      setIsCheckingSync(false);
    };

    checkForActiveSync();
  }, []); // Only run on mount

  // Update stored sync ID when global sync ID changes
  useEffect(() => {
    if (activeSyncId) {
      localStorage.setItem('active_sync_id', activeSyncId);
      setLocalSyncId(activeSyncId);
    }
  }, [activeSyncId]);

  // Handle sync status changes
  useEffect(() => {
    if (syncStatus.status === 'syncing') {
      // When a new sync starts, check if we have a stored ID
      const storedSyncId = localStorage.getItem('active_sync_id');
      if (storedSyncId && !localSyncId) {
        setLocalSyncId(storedSyncId);
        setActiveSyncId(storedSyncId);
      }
    } else if (syncStatus.status !== 'syncing' && syncStatus.status !== 'idle') {
      // Clear sync ID when sync completes or fails
      localStorage.removeItem('active_sync_id');
      setLocalSyncId(null);
      setActiveSyncId(null);
    }
  }, [syncStatus.status, setActiveSyncId, localSyncId]);

  const handleComplete = (summary: any) => {
    // Clear the sync ID
    localStorage.removeItem('active_sync_id');
    setLocalSyncId(null);
    
    // Refresh the page to show updated data
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const handleError = (error: string) => {
    // Clear the sync ID
    localStorage.removeItem('active_sync_id');
    setLocalSyncId(null);
    console.error('Sync error:', error);
  };

  // Show enhanced sync status if we have an active sync ID
  if (localSyncId || activeSyncId) {
    return (
      <EnhancedSyncStatus 
        syncId={localSyncId || activeSyncId || undefined}
        onComplete={handleComplete}
        onError={handleError}
      />
    );
  }

  return null;
}
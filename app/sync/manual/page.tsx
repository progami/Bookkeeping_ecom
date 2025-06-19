'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useGlobalSync } from '@/contexts/GlobalSyncContext';
import { UnifiedPageHeader } from '@/components/ui/unified-page-header';
import { SyncConfiguration, SyncConfig } from '@/components/sync-configuration';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Save, Loader2 } from 'lucide-react';
import { EnhancedSyncStatus } from '@/components/sync-status-enhanced';
import toast from 'react-hot-toast';

interface SyncProgress {
  status: string;
  syncId?: string;
  startedAt?: string;
  steps?: Record<string, { status: string; count: number }>;
  currentStep?: string;
  percentage?: number;
  errorMessage?: string;
}

export default function ManualSyncPage() {
  const router = useRouter();
  const { hasActiveToken } = useAuth();
  const { isAnySyncActive } = useGlobalSync();
  const [isLoading, setIsLoading] = useState(false);
  const [syncId, setSyncId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkpointInfo, setCheckpointInfo] = useState<any>(null);
  const [lastSyncId, setLastSyncId] = useState<string | null>(null);

  const handleSyncComplete = (summary: any) => {
    setSyncResult({ summary });
    toast.success('Sync completed successfully! Redirecting...');
    
    // Clear localStorage
    localStorage.removeItem('active_sync_id');
    console.log('[ManualSyncPage] Cleared active sync ID on completion');
    
    // Redirect after a brief delay
    setTimeout(() => {
      router.push('/finance');
    }, 2000);
  };

  const handleSyncError = (errorMessage: string) => {
    setError(errorMessage);
    toast.error(errorMessage || 'Sync failed');
    setIsLoading(false);
    
    // Clear localStorage
    localStorage.removeItem('active_sync_id');
    console.log('[ManualSyncPage] Cleared active sync ID on error');
    
    // Check for checkpoint when sync fails
    if (lastSyncId) {
      checkForCheckpoint(lastSyncId);
    }
  };
  
  // Check for existing checkpoint
  const checkForCheckpoint = async (syncIdToCheck: string) => {
    try {
      const response = await fetch(`/api/v1/xero/sync/checkpoint/${syncIdToCheck}`);
      const data = await response.json();
      
      if (data.exists && data.checkpoint) {
        setCheckpointInfo(data.checkpoint);
      }
    } catch (err) {
      console.error('Failed to check for checkpoint:', err);
    }
  };
  
  // Check localStorage for active sync ID on mount
  useEffect(() => {
    // Check for active sync first
    const activeSyncId = localStorage.getItem('active_sync_id');
    if (activeSyncId) {
      console.log('[ManualSyncPage] Found active sync in localStorage:', activeSyncId);
      setSyncId(activeSyncId);
      return; // Don't check for checkpoint if there's an active sync
    }
    
    // If no active sync, check for last sync checkpoint
    const storedSyncId = localStorage.getItem('lastHistoricalSyncId');
    if (storedSyncId) {
      setLastSyncId(storedSyncId);
      checkForCheckpoint(storedSyncId);
    }
  }, []);

  const handleSync = async (config: SyncConfig) => {
    if (isAnySyncActive) {
      toast.error('A sync is already in progress. Please wait for it to complete.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSyncResult(null);
    setSyncId(null);

    try {
      const syncOptions: any = {
        entities: config.entities || ['accounts', 'transactions', 'invoices', 'bills'],
      };

      // Set up sync parameters based on type
      if (config.syncType === 'historical' && config.historicalSyncFromDate) {
        syncOptions.historicalSyncFromDate = config.historicalSyncFromDate;
        toast('Starting historical sync. This may take several minutes...', {
          icon: '📊',
          duration: 5000,
        });
      } else if (config.syncType === 'custom') {
        if (config.fromDate) syncOptions.fromDate = config.fromDate;
        if (config.toDate) syncOptions.toDate = config.toDate;
      }
      const response = await fetch('/api/v1/xero/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forceSync: config.syncType !== 'recent',
          syncOptions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Sync failed');
      }

      // Handle queued sync vs direct sync
      if (data.status === 'queued' && data.syncId) {
        setSyncId(data.syncId);
        setLastSyncId(data.syncId); // Store for checkpoint checking
        localStorage.setItem('lastHistoricalSyncId', data.syncId); // Store in localStorage
        localStorage.setItem('active_sync_id', data.syncId); // Store as active sync
        console.log('[ManualSyncPage] Stored active sync ID:', data.syncId);
        toast('Sync has been queued for processing', {
          icon: '⏳',
          duration: 5000,
        });
      } else if (data.syncId) {
        // Direct sync with syncId for progress tracking
        setSyncId(data.syncId);
        setLastSyncId(data.syncId); // Store for checkpoint checking
        localStorage.setItem('lastHistoricalSyncId', data.syncId); // Store in localStorage
        localStorage.setItem('active_sync_id', data.syncId); // Store as active sync
        console.log('[ManualSyncPage] Stored active sync ID:', data.syncId);
      } else {
        // Direct sync completed immediately
        setSyncResult(data);
        toast.success('Sync completed successfully!');
        setTimeout(() => {
          router.push('/finance');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Sync error:', err.message || err.toString());
      if (err.stack) {
        console.error('Sync error stack:', err.stack);
      }
      setError(err.message || 'Failed to sync data');
      toast.error(err.message || 'Sync failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasActiveToken) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to connect to Xero first. <button onClick={() => window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent('/sync/manual')}`} className="underline">Connect now</button>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <UnifiedPageHeader
          title="Advanced Sync Settings"
          description="Configure sync options, import historical data, or sync specific date ranges"
          showBackButton
          backTo="/finance"
          backLabel="Back to Finance"
        />

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Active Sync Alert */}
          {isAnySyncActive && !syncId && (
            <Alert className="border-amber-500/30 bg-amber-950/30">
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-amber-100">Sync in Progress</p>
                  <p className="text-sm text-amber-200">
                    Another sync is currently running. Please wait for it to complete before starting a new sync.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Checkpoint Alert */}
          {checkpointInfo && !syncId && !syncResult && (
            <Alert className="border-blue-500/30 bg-blue-950/30">
              <Save className="h-4 w-4 text-blue-400" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-blue-100">Resume Previous Sync</p>
                  <p className="text-sm text-blue-200">
                    A previous sync was interrupted but saved a checkpoint.
                  </p>
                  <div className="text-xs text-blue-300/70 space-y-1">
                    <p>• Last saved: {new Date(checkpointInfo.timestamp).toLocaleString()}</p>
                    {checkpointInfo.processedCounts && (
                      <>
                        {checkpointInfo.processedCounts.contacts > 0 && (
                          <p>• Contacts synced: {checkpointInfo.processedCounts.contacts}</p>
                        )}
                        {checkpointInfo.processedCounts.accounts > 0 && (
                          <p>• Accounts synced: {checkpointInfo.processedCounts.accounts}</p>
                        )}
                        {checkpointInfo.processedCounts.transactions > 0 && (
                          <p>• Transactions synced: {checkpointInfo.processedCounts.transactions}</p>
                        )}
                        {checkpointInfo.processedCounts.invoices > 0 && (
                          <p>• Invoices synced: {checkpointInfo.processedCounts.invoices}</p>
                        )}
                        {checkpointInfo.processedCounts.bills > 0 && (
                          <p>• Bills synced: {checkpointInfo.processedCounts.bills}</p>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-sm text-blue-200 mt-3">
                    Starting a new sync will automatically resume from this checkpoint.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Configuration */}
          {!syncId && !syncResult && (
            <SyncConfiguration 
              onSync={handleSync} 
              isLoading={isLoading}
            />
          )}

          {/* Enhanced Sync Status with Polling */}
          {syncId && (
            <EnhancedSyncStatus
              syncId={syncId}
              onComplete={handleSyncComplete}
              onError={handleSyncError}
            />
          )}

          {/* Success Result */}
          {syncResult && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Sync Complete</h3>
              </div>
              
              {syncResult.summary && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">GL Accounts</div>
                    <div className="text-xl font-bold text-white">{syncResult.summary.glAccounts || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Transactions</div>
                    <div className="text-xl font-bold text-white">{syncResult.summary.transactions || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Invoices</div>
                    <div className="text-xl font-bold text-white">{syncResult.summary.invoices || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Bills</div>
                    <div className="text-xl font-bold text-white">{syncResult.summary.bills || 0}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
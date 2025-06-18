'use client';

import React from 'react';
import { useSync } from '@/contexts/SyncContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Loader2,
  XCircle 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
  const { syncStatus, syncWithXero, clearSyncError } = useSync();

  if (syncStatus.status === 'idle') {
    return null;
  }

  if (syncStatus.status === 'syncing') {
    return (
      <div className="fixed top-4 right-4 w-96 z-50">
        <Alert className="border-blue-500/30 bg-blue-950/50">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <AlertTitle className="text-blue-100">
            Syncing with Xero
          </AlertTitle>
          <AlertDescription className="text-blue-200">
            <div className="space-y-2">
              <p>Loading your financial data from Xero...</p>
              <Progress value={33} className="h-2" />
              <p className="text-sm opacity-75">This may take a few moments</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (syncStatus.status === 'failed') {
    return (
      <div className="fixed top-4 right-4 w-96 z-50">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>{syncStatus.error?.message || 'Unable to sync with Xero'}</p>
              
              {syncStatus.error?.code === 'RATE_LIMITED' && (
                <p className="text-sm">
                  Xero&apos;s rate limit has been reached. Please try again later.
                </p>
              )}
              
              {syncStatus.error?.code === 'DATABASE_TIMEOUT' && (
                <p className="text-sm">
                  The system is under heavy load. Please try again in a few moments.
                </p>
              )}
              
              <div className="flex gap-2 pt-2">
                {syncStatus.error?.retryable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncWithXero()}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Retry Sync
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => clearSyncError()}
                  className="flex-1"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Effect for success notification timeout
  React.useEffect(() => {
    if (syncStatus.status === 'success' && syncStatus.lastSyncAt) {
      const timer = setTimeout(() => {
        // Don't clear the sync status, just hide the notification
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus.status, syncStatus.lastSyncAt]);

  if (syncStatus.status === 'success' && syncStatus.lastSyncAt) {
    return (
      <div className="fixed top-4 right-4 w-96 z-50 animate-in fade-in slide-in-from-top-2">
        <Alert className="border-green-500/30 bg-green-950/50">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertTitle className="text-green-100">
            Sync Complete
          </AlertTitle>
          <AlertDescription className="text-green-200">
            <div className="space-y-1">
              <p>Your data is up to date</p>
              {syncStatus.data && (
                <p className="text-sm opacity-75">
                  {syncStatus.data.recordsCreated || 0} new records, {' '}
                  {syncStatus.data.recordsUpdated || 0} updated
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}

export function SyncStatusBar() {
  const { syncStatus, syncWithXero } = useSync();

  if (syncStatus.status === 'idle' || syncStatus.status === 'syncing') {
    return null;
  }

  if (syncStatus.status === 'failed') {
    return (
      <div className="bg-red-950/20 border-b border-red-900">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-200">
                Unable to load data from Xero. {syncStatus.error?.message}
              </span>
            </div>
            {syncStatus.error?.retryable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncWithXero()}
                className="text-red-700 hover:text-red-900"
              >
                <RefreshCw className="mr-2 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
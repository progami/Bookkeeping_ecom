'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Loader2,
  XCircle,
  Clock,
  Database,
  FileText,
  Receipt,
  Users,
  Package,
  AlertTriangle,
  ChevronRight,
  Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useGlobalSync } from '@/contexts/GlobalSyncContext';
import { apiRequest } from '@/lib/api-client';

interface SyncProgress {
  syncId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  percentage: number;
  currentStep: string;
  steps?: {
    accounts?: { status: string; count: number; details?: any };
    transactions?: { status: string; count: number; details?: any };
    invoices?: { status: string; count: number; details?: any };
    bills?: { status: string; count: number; details?: any };
    contacts?: { status: string; count: number; details?: any };
    summary?: { status: string; details?: any };
  };
  startedAt?: string;
  completedAt?: string;
  error?: string;
  lastUpdated?: string;
  checkpoint?: {
    restoredFrom?: string;
    lastSaved?: string;
    completedEntities?: string[];
  };
}

interface EnhancedSyncStatusProps {
  syncId?: string;
  onComplete?: (summary: any) => void;
  onError?: (error: string) => void;
}

const SYNC_STEPS = [
  { key: 'contacts', label: 'Contacts & Suppliers', icon: Users },
  { key: 'accounts', label: 'Chart of Accounts', icon: Database },
  { key: 'transactions', label: 'Bank Transactions', icon: FileText },
  { key: 'invoices', label: 'Sales Invoices', icon: Receipt },
  { key: 'bills', label: 'Purchase Bills', icon: FileText },
];

export function EnhancedSyncStatus({ syncId, onComplete, onError }: EnhancedSyncStatusProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { setActiveSyncId } = useGlobalSync();

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!syncId) return;

    try {
      console.log('[EnhancedSyncStatus] Fetching progress for syncId:', syncId);
      const response = await apiRequest(`/api/v1/xero/sync/progress/${syncId}`);
      const data = await response.json();

      if (response.ok && data) {
        setProgress(data);

        if (data.status === 'completed') {
          console.log('[EnhancedSyncStatus] Sync completed!');
          stopPolling();
          setShowSuccess(true);
        } else if (data.status === 'failed') {
          console.log('[EnhancedSyncStatus] Sync failed:', data.error);
          stopPolling();
          setActiveSyncId(null);
          localStorage.removeItem('active_sync_id');
          if (onError) {
            onError(data.error || 'Sync failed');
          }
        }
      } else {
        console.warn('[EnhancedSyncStatus] Invalid response:', response.status, data);
      }
    } catch (error) {
      console.error('[EnhancedSyncStatus] Failed to fetch sync progress:', error);
    }
  }, [syncId, onError, setActiveSyncId, stopPolling]);

  useEffect(() => {
    if (syncId) {
      setActiveSyncId(syncId);
      poll(); // Initial fetch
      
      // Clear any existing interval before setting a new one
      stopPolling();
      pollingIntervalRef.current = setInterval(poll, 2000);
    }

    return () => {
      stopPolling();
    };
  }, [syncId, poll, setActiveSyncId, stopPolling]);

  useEffect(() => {
    if (showSuccess && progress?.status === 'completed') {
      const timer = setTimeout(() => {
        setActiveSyncId(null);
        localStorage.removeItem('active_sync_id');
        if (onComplete) {
          onComplete(progress?.steps);
        }
        setShowSuccess(false);
        setProgress(null);
      }, 10000); // Show success for 10 seconds
      return () => clearTimeout(timer);
    }
  }, [showSuccess, onComplete, setActiveSyncId, progress]);

  if (!progress) {
    return null;
  }

  // Calculate overall progress from steps
  const calculateOverallProgress = () => {
    if (!progress.steps) return progress.percentage;

    const steps = Object.values(progress.steps).filter(step => step && typeof step.status === 'string');
    if (steps.length === 0) return progress.percentage;

    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const inProgressSteps = steps.filter(step => step.status === 'in_progress').length;
    
    const stepProgress = (completedSteps + (inProgressSteps * 0.5)) / steps.length * 100;
    return Math.max(progress.percentage, Math.round(stepProgress));
  };

  const getStepStatus = (stepKey: string) => {
    if (!progress.steps) return 'pending';
    const step = progress.steps[stepKey as keyof typeof progress.steps];
    return step?.status || 'pending';
  };

  const getStepCount = (stepKey: string) => {
    if (!progress.steps) return 0;
    const step = progress.steps[stepKey as keyof typeof progress.steps];
    return step?.count || 0;
  };

  const overallProgress = calculateOverallProgress();
  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  // Common layout for all states
  return (
    <>
      {/* Full screen overlay */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
      
      {/* Centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-800 overflow-hidden">
            {/* Header */}
            <div className={`
              p-6 transition-colors duration-500
              ${isCompleted 
                ? 'bg-gradient-to-r from-green-600 to-green-700' 
                : isFailed
                ? 'bg-gradient-to-r from-red-600 to-red-700'
                : 'bg-gradient-to-r from-blue-600 to-blue-700'
              }
            `}>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-full">
                  {isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  ) : isFailed ? (
                    <XCircle className="h-6 w-6 text-white" />
                  ) : (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white">
                    {isCompleted 
                      ? 'Sync Completed Successfully' 
                      : isFailed
                      ? 'Sync Failed'
                      : progress.status === 'pending' 
                      ? 'Preparing Xero Sync' 
                      : 'Syncing with Xero'
                    }
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    {isCompleted
                      ? 'All data has been synchronized'
                      : isFailed
                      ? 'An error occurred during synchronization'
                      : progress.currentStep || 'Initializing synchronization...'
                    }
                  </p>
                </div>
                {isCompleted && (
                  <button
                    onClick={() => {
                      setShowSuccess(false);
                      setProgress(null);
                      setActiveSyncId(null);
                      localStorage.removeItem('active_sync_id');
                      if (onComplete) {
                        onComplete(progress?.steps);
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <XCircle className="h-5 w-5 text-white/80 hover:text-white" />
                  </button>
                )}
              </div>

              {/* Overall Progress Bar */}
              {!isCompleted && !isFailed && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-white/80">Overall Progress</span>
                    <span className="text-sm font-semibold text-white">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2 bg-white/20" />
                </div>
              )}
            </div>

            {/* Body with two columns */}
            <div className="flex">
              {/* Left Menu - Sync Steps */}
              <div className="w-80 bg-gray-950 p-6 border-r border-gray-800">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                  Sync Progress Menu
                </h3>
                <div className="space-y-2">
                  {SYNC_STEPS.map((step) => {
                    const status = getStepStatus(step.key);
                    const count = getStepCount(step.key);
                    const Icon = step.icon;
                    
                    return (
                      <div
                        key={step.key}
                        className={`
                          p-3 rounded-lg border transition-all duration-300
                          ${status === 'completed' 
                            ? 'bg-green-900/20 border-green-800/50' 
                            : status === 'in_progress'
                            ? 'bg-blue-900/20 border-blue-800/50 animate-pulse'
                            : status === 'failed'
                            ? 'bg-red-900/20 border-red-800/50'
                            : 'bg-gray-800/30 border-gray-700/30'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`
                            p-2 rounded-lg
                            ${status === 'completed' 
                              ? 'bg-green-800/30 text-green-400' 
                              : status === 'in_progress'
                              ? 'bg-blue-800/30 text-blue-400'
                              : status === 'failed'
                              ? 'bg-red-800/30 text-red-400'
                              : 'bg-gray-700/30 text-gray-500'
                            }
                          `}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-200">
                              {step.label}
                            </p>
                            {count > 0 && (
                              <p className="text-xs text-gray-400">
                                {count.toLocaleString()} records
                              </p>
                            )}
                          </div>
                          <div>
                            {status === 'completed' && (
                              <CheckCircle2 className="h-4 w-4 text-green-400" />
                            )}
                            {status === 'in_progress' && (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                            )}
                            {status === 'failed' && (
                              <XCircle className="h-4 w-4 text-red-400" />
                            )}
                            {status === 'pending' && (
                              <Clock className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary Stats */}
                {progress.steps && (
                  <div className="mt-6 pt-6 border-t border-gray-800">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Total Records</span>
                        <span className="font-semibold text-gray-200">
                          {Object.values(progress.steps)
                            .filter(step => step && typeof step.count === 'number')
                            .reduce((sum, step) => sum + (step.count || 0), 0)
                            .toLocaleString()}
                        </span>
                      </div>
                      {progress.startedAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">Duration</span>
                          <span className="text-gray-200">
                            {isCompleted && progress.completedAt
                              ? formatDistanceToNow(new Date(progress.startedAt), { addSuffix: false })
                              : `${formatDistanceToNow(new Date(progress.startedAt), { addSuffix: false })} so far`
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Content Area */}
              <div className="flex-1 p-6">
                {isFailed ? (
                  <div className="space-y-4">
                    <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                      <p className="text-gray-300">
                        {progress.error || 'An unexpected error occurred during synchronization.'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setProgress(null);
                        window.location.reload();
                      }}
                      className="w-full"
                    >
                      Dismiss & Refresh Page
                    </Button>
                  </div>
                ) : isCompleted ? (
                  <div className="space-y-6">
                    <div className="text-center py-8">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-900/20 rounded-full mb-4">
                        <CheckCircle2 className="h-8 w-8 text-green-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-200 mb-2">
                        All Done!
                      </h3>
                      <p className="text-gray-400">
                        Your Xero data has been successfully synchronized
                      </p>
                    </div>

                    {/* Detailed Summary */}
                    {progress.steps?.summary?.details && (
                      <div className="bg-gray-800/30 rounded-lg p-6">
                        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                          Synchronization Summary
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(JSON.parse(progress.steps.summary.details)).map(([entity, count]) => (
                            <div key={entity} className="bg-gray-900/50 rounded-lg p-4">
                              <p className="text-sm text-gray-400 capitalize">{entity}</p>
                              <p className="text-2xl font-semibold text-green-400 mt-1">
                                {Number(count).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center text-sm text-gray-500">
                      This window will close automatically in a few seconds
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Current Activity */}
                    <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Activity className="h-5 w-5 text-blue-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-200">
                            Current Activity
                          </p>
                          <p className="text-sm text-blue-300/80 mt-1">
                            {progress.currentStep || 'Processing...'}
                          </p>
                          {progress.steps && Object.entries(progress.steps).map(([key, step]) => {
                            if (step.status === 'in_progress' && step.details) {
                              return (
                                <p key={key} className="text-xs text-blue-400 mt-2">
                                  {step.details}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Checkpoint Info */}
                    {progress.checkpoint?.lastSaved && (
                      <div className="bg-gray-800/30 rounded-lg p-4">
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Progress automatically saved {formatDistanceToNow(new Date(progress.checkpoint.lastSaved), { addSuffix: true })}
                        </p>
                      </div>
                    )}

                    {/* Warning */}
                    <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-200">
                          Important
                        </p>
                        <p className="text-xs text-amber-300/80 mt-1">
                          Please keep this window open until the synchronization is complete. 
                          Your progress is being saved automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
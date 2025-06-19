'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Loader2,
  XCircle,
  Clock,
  Database,
  FileText,
  Receipt,
  Users
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

export function EnhancedSyncStatus({ syncId, onComplete, onError }: EnhancedSyncStatusProps) {
  const [progress, setProgress] = React.useState<SyncProgress | null>(null);
  const [isPolling, setIsPolling] = React.useState(false);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Poll for progress updates
  const fetchProgress = React.useCallback(async () => {
    if (!syncId) return;

    try {
      const response = await fetch(`/api/v1/xero/sync/progress/${syncId}`);
      const data = await response.json();

      if (response.ok && data) {
        setProgress(data);

        // Check if sync is complete
        if (data.status === 'completed') {
          setIsPolling(false);
          setShowSuccess(true);
          if (onComplete) {
            onComplete(data.steps);
          }
        } else if (data.status === 'failed') {
          setIsPolling(false);
          if (onError) {
            onError(data.error || 'Sync failed');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch sync progress:', error);
    }
  }, [syncId, onComplete, onError]);

  // Start polling when syncId is provided
  React.useEffect(() => {
    if (syncId && !isPolling) {
      setIsPolling(true);
      fetchProgress(); // Initial fetch

      // Poll every 2 seconds
      pollingIntervalRef.current = setInterval(fetchProgress, 2000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [syncId, isPolling, fetchProgress]);

  // Auto-hide success after 10 seconds
  React.useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false);
        setProgress(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  if (!progress) {
    return null;
  }

  // Calculate overall progress from steps
  const calculateOverallProgress = () => {
    if (!progress.steps) return progress.percentage;

    const steps = Object.values(progress.steps);
    if (steps.length === 0) return progress.percentage;

    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const inProgressSteps = steps.filter(step => step.status === 'in_progress').length;
    
    const stepProgress = (completedSteps + (inProgressSteps * 0.5)) / steps.length * 100;
    return Math.max(progress.percentage, Math.round(stepProgress));
  };

  const getStepIcon = (stepName: string) => {
    switch (stepName) {
      case 'accounts': return <Database className="h-4 w-4" />;
      case 'transactions': return <FileText className="h-4 w-4" />;
      case 'invoices': return <Receipt className="h-4 w-4" />;
      case 'bills': return <FileText className="h-4 w-4" />;
      case 'contacts': return <Users className="h-4 w-4" />;
      default: return <Loader2 className="h-4 w-4" />;
    }
  };

  const getStepLabel = (stepName: string) => {
    switch (stepName) {
      case 'accounts': return 'Chart of Accounts';
      case 'transactions': return 'Transactions';
      case 'invoices': return 'Sales Invoices';
      case 'bills': return 'Bills';
      case 'contacts': return 'Contacts';
      default: return stepName;
    }
  };

  if (progress.status === 'in_progress' || progress.status === 'pending') {
    const overallProgress = calculateOverallProgress();

    return (
      <div className="fixed top-4 right-4 w-96 z-50">
        <Alert className="border-blue-500/30 bg-blue-950/50">
          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          <AlertTitle className="text-blue-100">
            {progress.status === 'pending' ? 'Preparing Sync' : 'Syncing with Xero'}
          </AlertTitle>
          <AlertDescription className="text-blue-200">
            <div className="space-y-3">
              <p className="text-sm">{progress.currentStep}</p>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2" />
              </div>

              {progress.steps && Object.keys(progress.steps).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-blue-800/50">
                  {Object.entries(progress.steps).map(([stepName, stepData]) => (
                    <div key={stepName} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {getStepIcon(stepName)}
                          <span>{getStepLabel(stepName)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {stepData.status === 'completed' && (
                            <CheckCircle2 className="h-3 w-3 text-green-400" />
                          )}
                          {stepData.status === 'in_progress' && (
                            <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                          )}
                          {stepData.status === 'pending' && (
                            <Clock className="h-3 w-3 text-gray-400" />
                          )}
                          <span className="text-gray-400">
                            {stepData.count > 0 ? stepData.count.toLocaleString() : '-'}
                          </span>
                        </div>
                      </div>
                      {stepData.status === 'in_progress' && stepData.details && (
                        <p className="text-xs text-blue-300/60 pl-6">
                          {stepData.details}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {progress.startedAt && (
                <p className="text-xs text-blue-300/70">
                  Started {formatDistanceToNow(new Date(progress.startedAt), { addSuffix: true })}
                </p>
              )}
              
              {progress.checkpoint && (
                <div className="space-y-1 pt-2 border-t border-blue-800/50">
                  {progress.checkpoint.restoredFrom && (
                    <p className="text-xs text-blue-300/60">
                      ✅ Resumed from checkpoint saved {formatDistanceToNow(new Date(progress.checkpoint.restoredFrom), { addSuffix: true })}
                    </p>
                  )}
                  {progress.checkpoint.lastSaved && (
                    <p className="text-xs text-blue-300/60">
                      💾 Last checkpoint: {formatDistanceToNow(new Date(progress.checkpoint.lastSaved), { addSuffix: true })}
                    </p>
                  )}
                </div>
              )}
              
              <p className="text-xs text-blue-300/60 italic">
                💡 You can safely navigate away - the sync will continue in the background
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (progress.status === 'failed') {
    return (
      <div className="fixed top-4 right-4 w-96 z-50">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>{progress.error || 'Unable to complete sync with Xero'}</p>
              
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProgress(null)}
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

  if (progress.status === 'completed' && showSuccess) {
    const summary = progress.steps || {};
    const totalRecords = Object.values(summary).reduce((acc, step) => acc + (step.count || 0), 0);

    return (
      <div className="fixed top-4 right-4 w-96 z-50 animate-in fade-in slide-in-from-top-2">
        <Alert className="border-green-500/30 bg-green-950/50 relative">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <AlertTitle className="text-green-100 pr-8">
            Sync Complete
          </AlertTitle>
          <AlertDescription className="text-green-200">
            <div className="space-y-3">
              <p>Your data is up to date</p>
              
              {Object.keys(summary).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-green-800/50">
                  <p className="text-xs font-medium">Summary:</p>
                  {Object.entries(summary).map(([stepName, stepData]) => (
                    <div key={stepName} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {getStepIcon(stepName)}
                        <span>{getStepLabel(stepName)}</span>
                      </div>
                      <span className="text-green-300">
                        {stepData.count?.toLocaleString() || 0} records
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-green-800/50">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Total</span>
                      <span className="text-green-300">{totalRecords.toLocaleString()} records</span>
                    </div>
                  </div>
                </div>
              )}

              {progress.completedAt && progress.startedAt && (
                <p className="text-xs text-green-300/70">
                  Completed in {formatDistanceToNow(new Date(progress.startedAt), { addSuffix: false })}
                </p>
              )}
            </div>
          </AlertDescription>
          <button
            onClick={() => {
              setShowSuccess(false);
              setProgress(null);
            }}
            className="absolute top-2 right-2 p-1 hover:bg-green-900/50 rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <XCircle className="h-4 w-4 text-green-400/60 hover:text-green-400" />
          </button>
        </Alert>
      </div>
    );
  }

  return null;
}
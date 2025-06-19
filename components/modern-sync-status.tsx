'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Clock,
  Database,
  FileText,
  Users,
  CreditCard,
  Activity,
  Sparkles,
  Zap,
  X
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

interface SyncProgress {
  syncId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  percentage: number;
  currentStep: string;
  steps: {
    [key: string]: {
      status: 'pending' | 'in_progress' | 'completed';
      count?: number;
      details?: string;
      error?: string;
    }
  };
  error?: string;
  startedAt: string;
  lastUpdated?: string;
  completedAt?: string;
}

const stepIcons: Record<string, React.ElementType> = {
  accounts: Database,
  transactions: CreditCard,
  invoices: FileText,
  bills: FileText,
  contacts: Users,
  summary: Activity
};

const stepLabels: Record<string, string> = {
  accounts: 'Chart of Accounts',
  transactions: 'Bank Transactions',
  invoices: 'Sales Invoices',
  bills: 'Purchase Bills',
  contacts: 'Contacts',
  summary: 'Summary'
};

export function ModernSyncStatus({ syncId }: { syncId?: string }) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState<string>('');

  useEffect(() => {
    if (!syncId) return;

    let pollInterval: NodeJS.Timeout;
    let startTime = Date.now();

    const fetchProgress = async () => {
      try {
        const response = await apiRequest(`/api/v1/xero/sync/progress/${syncId}`);
        
        console.log('Sync progress response:', response);
        
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          setIsVisible(true);

          // Calculate estimated time
          if (data.status === 'in_progress' && data.percentage > 0) {
            const elapsed = Date.now() - startTime;
            const estimatedTotal = elapsed / (data.percentage / 100);
            const remaining = estimatedTotal - elapsed;
            const remainingMinutes = Math.ceil(remaining / 60000);
            
            if (remainingMinutes > 1) {
              setEstimatedTime(`~${remainingMinutes} minutes remaining`);
            } else {
              setEstimatedTime('Less than a minute remaining');
            }
          }

          // Stop polling if completed or failed
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(pollInterval);
            
            // Auto-hide after 10 seconds for completed syncs
            if (data.status === 'completed') {
              setTimeout(() => setIsVisible(false), 10000);
            }
          }
        } else {
          console.error('API error:', response.status, response.statusText);
          // Don't stop polling on error - keep trying
        }
      } catch (error) {
        console.error('Failed to fetch sync progress:', error);
        // Don't stop polling on error - keep trying
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 500ms for smooth updates
    pollInterval = setInterval(fetchProgress, 500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [syncId]);

  if (!progress || !isVisible) return null;

  const getStepStatus = (stepKey: string) => {
    const step = progress.steps[stepKey];
    if (!step) return { icon: stepIcons[stepKey], status: 'pending', count: 0 };
    
    return {
      icon: stepIcons[stepKey],
      status: step.status,
      count: step.count || 0,
      details: step.details
    };
  };

  const renderStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed top-4 right-4 w-[420px] z-50"
      >
        <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/95 backdrop-blur-lg shadow-2xl">
          {/* Animated gradient background */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 animate-gradient" />
          </div>

          {/* Header */}
          <div className="relative px-6 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {progress.status === 'completed' ? (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20">
                    <Sparkles className="w-5 h-5 text-green-400" />
                  </div>
                ) : progress.status === 'failed' ? (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20">
                    <XCircle className="w-5 h-5 text-red-400" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500/20">
                      <Zap className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {progress.status === 'completed' ? 'Sync Complete!' : 
                     progress.status === 'failed' ? 'Sync Failed' : 
                     'Syncing with Xero'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {progress.currentStep}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {progress.status === 'in_progress' && (
            <div className="px-6 py-3 border-b border-gray-800">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-white font-medium">{progress.percentage}%</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${progress.percentage}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                  <div className="absolute inset-0 bg-white/10 animate-shimmer" />
                </div>
                {estimatedTime && (
                  <p className="text-xs text-gray-400 text-right">{estimatedTime}</p>
                )}
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="px-6 py-4 space-y-3">
            {Object.entries(stepLabels).map(([key, label]) => {
              const step = getStepStatus(key);
              if (!step || (key === 'summary' && progress.status !== 'completed')) return null;

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    step.status === 'completed' 
                      ? 'border-green-900/50 bg-green-950/30' 
                      : step.status === 'in_progress'
                      ? 'border-blue-900/50 bg-blue-950/30'
                      : 'border-gray-800/50 bg-gray-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      step.status === 'completed' 
                        ? 'bg-green-500/20' 
                        : step.status === 'in_progress'
                        ? 'bg-blue-500/20'
                        : 'bg-gray-800'
                    }`}>
                      {React.createElement(step.icon || Activity, { 
                        className: `w-4 h-4 ${
                          step.status === 'completed' 
                            ? 'text-green-400' 
                            : step.status === 'in_progress'
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`
                      })}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{label}</p>
                      {step.count > 0 && (
                        <p className="text-xs text-gray-400">
                          {step.count.toLocaleString()} items
                        </p>
                      )}
                    </div>
                  </div>
                  {renderStepIcon(step.status)}
                </motion.div>
              );
            })}
          </div>

          {/* Error message */}
          {progress.error && (
            <div className="px-6 pb-4">
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-900/50">
                <p className="text-sm text-red-300">{progress.error}</p>
              </div>
            </div>
          )}

          {/* Summary for completed syncs */}
          {progress.status === 'completed' && progress.steps.summary?.details && (
            <div className="px-6 pb-4">
              <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/50">
                <p className="text-sm text-green-300">
                  Sync completed successfully!
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// CSS for animations (add to globals.css)
const animationStyles = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes gradient {
  0%, 100% {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.5);
  }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}

.animate-gradient {
  animation: gradient 10s ease-in-out infinite;
}
`;
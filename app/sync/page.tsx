'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

export default function SyncPage() {
  const router = useRouter();
  const { syncStatus, syncWithXero } = useSync();
  const { hasXeroConnection } = useAuth();
  const [syncStarted, setSyncStarted] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    // If no Xero connection, redirect to connect page
    if (!hasXeroConnection) {
      router.push('/connect');
      return;
    }

    // Start sync automatically
    if (!syncStarted && syncStatus.status === 'idle') {
      setSyncStarted(true);
      syncWithXero();
    }

    // Check setup status after successful sync
    if (syncStatus.status === 'success' && !setupChecked) {
      setSetupChecked(true);
      
      // Check if user has completed setup
      fetch('/api/v1/setup/status')
        .then(res => res.json())
        .then(data => {
          if (!data.hasCompletedSetup) {
            // First time user - go to setup
            setTimeout(() => {
              router.push('/setup');
            }, 1500);
          } else {
            // Setup already complete - go to return URL or finance
            const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
            setTimeout(() => {
              router.push(returnUrl || '/finance');
            }, 1500);
          }
        })
        .catch(err => {
          console.error('Failed to check setup status:', err);
          // On error, default to finance page
          setTimeout(() => {
            router.push('/finance');
          }, 1500);
        });
    }
  }, [hasXeroConnection, syncStatus, syncStarted, syncWithXero, router, setupChecked]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {syncStatus.status === 'syncing' && 'Syncing Your Data'}
            {syncStatus.status === 'success' && 'Sync Complete!'}
            {syncStatus.status === 'failed' && 'Sync Failed'}
          </CardTitle>
          <CardDescription>
            {syncStatus.status === 'syncing' && 'Loading your financial data from Xero'}
            {syncStatus.status === 'success' && 'Your data is ready'}
            {syncStatus.status === 'failed' && 'We couldn&apos;t sync your data'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Syncing State */}
            {syncStatus.status === 'syncing' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
                </div>
                <Progress value={33} className="h-2" />
                <p className="text-sm text-center text-muted-foreground">
                  This may take a few moments for the initial sync...
                </p>
              </div>
            )}

            {/* Success State */}
            {syncStatus.status === 'success' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                {syncStatus.data && (
                  <div className="text-center space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Synced {syncStatus.data.recordsCreated || 0} new records
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Updated {syncStatus.data.recordsUpdated || 0} existing records
                    </p>
                  </div>
                )}
                <p className="text-sm text-center text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
              </div>
            )}

            {/* Failed State */}
            {syncStatus.status === 'failed' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <XCircle className="h-12 w-12 text-red-600" />
                </div>
                
                <Alert variant="destructive">
                  <AlertDescription>
                    {syncStatus.error?.message || 'Unable to sync with Xero'}
                  </AlertDescription>
                </Alert>

                {syncStatus.error?.code === 'RATE_LIMITED' && (
                  <Alert>
                    <AlertDescription>
                      Xero's API rate limit has been reached. This usually happens when too many requests are made in a short time. Please wait a few minutes before trying again.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  {syncStatus.error?.retryable && (
                    <Button
                      onClick={() => syncWithXero()}
                      className="flex-1"
                      variant="outline"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Try Again
                    </Button>
                  )}
                  <Button
                    onClick={() => router.push('/finance')}
                    className="flex-1"
                    variant={syncStatus.error?.retryable ? 'outline' : 'default'}
                  >
                    Continue Without Data
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
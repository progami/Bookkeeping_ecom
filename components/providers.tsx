'use client';

import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { GlobalSyncProvider } from '@/contexts/GlobalSyncContext';
import { SyncStatus } from '@/components/sync-status';
import { GlobalSyncMonitor } from '@/components/global-sync-monitor';

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show a loading state until the client-side JavaScript is ready
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <GlobalSyncProvider>
          <SyncProvider>
            <SyncStatus />
            <GlobalSyncMonitor />
            {children}
            <Toaster 
              position="top-right"
              toastOptions={{
                style: {
                  background: '#1e293b',
                  color: '#fff',
                  border: '1px solid #334155'
                }
              }}
            />
          </SyncProvider>
        </GlobalSyncProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
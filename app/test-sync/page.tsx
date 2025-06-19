'use client';

import { useState } from 'react';
import { useSync } from '@/contexts/SyncContext';
import { ModernSyncStatus } from '@/components/modern-sync-status';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function TestSyncPage() {
  const { syncWithXero, syncStatus } = useSync();
  const [syncId, setSyncId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSync = async () => {
    setIsLoading(true);
    try {
      const id = await syncWithXero();
      if (id) {
        setSyncId(id);
        console.log('Sync started with ID:', id);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Test Sync Progress</h1>
        
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sync Controls</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Current Status: {syncStatus.status}</p>
                {syncId && (
                  <p className="text-sm text-gray-400 mb-2">Sync ID: {syncId}</p>
                )}
              </div>
              
              <Button
                onClick={handleSync}
                disabled={isLoading || syncStatus.status === 'syncing'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Starting Sync...' : 'Start Sync'}
              </Button>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
            <pre className="text-xs bg-gray-950 p-4 rounded overflow-auto">
              {JSON.stringify({ syncStatus, syncId }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
      
      {/* Modern sync status will appear when sync is in progress */}
      {syncId && <ModernSyncStatus syncId={syncId} />}
    </div>
  );
}
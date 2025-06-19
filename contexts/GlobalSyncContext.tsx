'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface GlobalSyncContextType {
  activeSyncId: string | null;
  isAnySyncActive: boolean;
  setActiveSyncId: (syncId: string | null) => void;
}

const GlobalSyncContext = createContext<GlobalSyncContextType | undefined>(undefined);

export function GlobalSyncProvider({ children }: { children: React.ReactNode }) {
  const [activeSyncId, setActiveSyncId] = useState<string | null>(null);

  const contextValue: GlobalSyncContextType = {
    activeSyncId,
    isAnySyncActive: !!activeSyncId,
    setActiveSyncId,
  };

  return (
    <GlobalSyncContext.Provider value={contextValue}>
      {children}
    </GlobalSyncContext.Provider>
  );
}

export function useGlobalSync() {
  const context = useContext(GlobalSyncContext);
  if (!context) {
    throw new Error('useGlobalSync must be used within a GlobalSyncProvider');
  }
  return context;
}
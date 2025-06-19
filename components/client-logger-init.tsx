'use client';

import { useEffect } from 'react';
import { initializeClientLogger } from '@/lib/client-logger';

export function ClientLoggerInit() {
  useEffect(() => {
    console.log('[ClientLoggerInit] Component mounted, initializing client logger...');
    initializeClientLogger();
  }, []);
  
  return null;
}
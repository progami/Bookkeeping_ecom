'use client';

import { useEffect } from 'react';
import { initializeClientLogger } from '@/lib/client-logger';

export function ClientLoggerInit() {
  useEffect(() => {
    initializeClientLogger();
  }, []);
  
  return null;
}
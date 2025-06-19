'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to log component lifecycle events in development
 * Helps track component mounting, unmounting, and re-renders
 */
export function useComponentLogger(componentName: string, props?: Record<string, any>) {
  const renderCount = useRef(0);
  const mountTime = useRef<number>(0);
  
  // Only log in development
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  // Log render
  renderCount.current += 1;
  if (renderCount.current === 1) {
    mountTime.current = performance.now();
    console.log(`[Component Mount] ${componentName}`, {
      props: props ? Object.keys(props) : [],
      timestamp: new Date().toISOString()
    });
  } else {
    console.log(`[Component Re-render] ${componentName}`, {
      renderCount: renderCount.current,
      props: props ? Object.keys(props) : []
    });
  }
  
  // Log unmount
  useEffect(() => {
    return () => {
      const lifetime = performance.now() - mountTime.current;
      console.log(`[Component Unmount] ${componentName}`, {
        lifetime: Math.round(lifetime) + 'ms',
        totalRenders: renderCount.current
      });
    };
  }, [componentName]);
}

/**
 * Hook to log effect executions
 */
export function useEffectLogger(effectName: string, deps?: React.DependencyList) {
  const effectCount = useRef(0);
  
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  
  useEffect(() => {
    effectCount.current += 1;
    console.log(`[Effect Run] ${effectName}`, {
      runCount: effectCount.current,
      deps: deps || 'no deps'
    });
    
    return () => {
      console.log(`[Effect Cleanup] ${effectName}`);
    };
  }, deps);
}
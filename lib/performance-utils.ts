import { useEffect, useRef } from 'react';

// Performance monitoring utilities
export const measurePageLoad = (pageName: string) => {
  if (typeof window === 'undefined') return;
  
  // Use Navigation Timing API to measure page load
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      const ttfb = navigation.responseStart - navigation.fetchStart; // Time to First Byte
      
      console.log(`[Performance] ${pageName} Metrics:`, {
        totalLoadTime: `${loadTime}ms`,
        domContentLoaded: `${domContentLoaded}ms`,
        timeToFirstByte: `${ttfb}ms`,
        domInteractive: `${navigation.domInteractive - navigation.fetchStart}ms`,
      });
    }
  });
};

// Prefetch data for sub-modules
export const prefetchSubModuleData = async (moduleName: string) => {
  const prefetchUrls: Record<string, string[]> = {
    bookkeeping: [
      '/api/v1/xero/reports/balance-sheet',
      '/api/v1/xero/reports/profit-loss',
      '/api/v1/bookkeeping/stats',
      '/api/v1/bookkeeping/bank-accounts'
    ],
    cashflow: [
      '/api/v1/cashflow/forecast?days=90&scenarios=false'
    ],
    analytics: [
      '/api/v1/analytics/top-vendors'
    ]
  };

  const urls = prefetchUrls[moduleName] || [];
  
  // Use link prefetch for better browser support
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  });
};

// Hook to lazy load heavy components
export const useLazyComponent = (importFn: () => Promise<any>, delay: number = 0) => {
  const componentRef = useRef<any>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      importFn().then(module => {
        componentRef.current = module.default || module;
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [importFn, delay]);
  
  return componentRef.current;
};

// Debounce API calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Request queue to prevent concurrent API calls
export class RequestQueue {
  private queue: Array<{ url: string; resolve: (value: any) => void; reject: (error: any) => void }> = [];
  private processing = false;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
    
    return new Promise((resolve, reject) => {
      this.queue.push({ url, resolve, reject });
      this.process();
    });
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    const { url, resolve, reject } = this.queue.shift()!;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Cache successful responses
      if (response.ok) {
        this.cache.set(url, { data, timestamp: Date.now() });
      }
      
      resolve(new Response(JSON.stringify(data), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
      }));
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      // Process next request after a small delay
      setTimeout(() => this.process(), 100);
    }
  }
  
  clearCache() {
    this.cache.clear();
  }
}

// Singleton request queue
export const requestQueue = new RequestQueue();
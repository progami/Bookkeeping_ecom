import { universalLogger as structuredLogger } from './universal-logger';

export function measurePageLoad(pageName: string) {
  if (typeof window !== 'undefined' && window.performance) {
    const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
    structuredLogger.info(`[Performance] ${pageName} page loaded in ${loadTime}ms`);
    return loadTime;
  }
  return 0;
}

export function measureApiCall(endpoint: string, duration: number) {
  structuredLogger.info(`[Performance] API call to ${endpoint} took ${duration}ms`);
  return duration;
}

export function measureComponentRender(componentName: string, duration: number) {
  if (duration > 100) {
    structuredLogger.warn(`[Performance] ${componentName} render took ${duration}ms (slow)`);
  } else {
    structuredLogger.debug(`[Performance] ${componentName} render took ${duration}ms`);
  }
  return duration;
}

export function prefetchSubModuleData(moduleName: string) {
  structuredLogger.debug(`[Performance] Prefetching data for ${moduleName} module`);
  // This is a placeholder for prefetching logic
  // In a real implementation, you might prefetch API data or preload components
  return Promise.resolve();
}
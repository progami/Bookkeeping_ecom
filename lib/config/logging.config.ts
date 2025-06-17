// Centralized logging configuration
export const LogConfig = {
  // Global log level - controls verbosity
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'info'),
  
  // Feature flags for different log types
  features: {
    // Auth context logs - disable verbose auth checks
    authContext: process.env.LOG_AUTH === 'true' || false,
    
    // API request/response logs
    apiRequests: process.env.LOG_API === 'true' || false,
    
    // Database queries
    dbQueries: process.env.LOG_DB === 'true' || false,
    
    // Xero API calls
    xeroApi: process.env.LOG_XERO === 'true' || false,
    
    // Performance metrics
    performance: process.env.LOG_PERF === 'true' || false,
    
    // Cache operations
    cache: process.env.LOG_CACHE === 'true' || false,
    
    // Rate limiting
    rateLimit: process.env.LOG_RATE_LIMIT === 'true' || false,
  },
  
  // Concise log formats
  formats: {
    // API request format
    apiRequest: (method: string, url: string) => `${method} ${url}`,
    
    // API response format
    apiResponse: (method: string, url: string, status: number, duration: number) => 
      `${method} ${url} → ${status} (${duration}ms)`,
    
    // Error format
    error: (message: string, error: any) => {
      const errorMsg = error?.message || error?.toString() || 'Unknown error';
      return `❌ ${message}: ${errorMsg}`;
    },
    
    // Success format
    success: (message: string) => `✅ ${message}`,
    
    // Warning format
    warning: (message: string) => `⚠️  ${message}`,
    
    // Info format
    info: (message: string) => `ℹ️  ${message}`,
  }
};

// Helper to check if a feature is enabled
export const shouldLog = (feature: keyof typeof LogConfig.features): boolean => {
  return LogConfig.features[feature];
};

// Concise logger wrapper
export class ConciseLogger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  private shouldLogLevel(level: string): boolean {
    const levels = ['error', 'warn', 'info', 'debug'];
    const currentLevel = levels.indexOf(LogConfig.level);
    const requestedLevel = levels.indexOf(level);
    return requestedLevel <= currentLevel;
  }
  
  error(message: string, error?: any) {
    if (this.shouldLogLevel('error')) {
      console.error(`[${this.context}] ${LogConfig.formats.error(message, error)}`);
    }
  }
  
  warn(message: string) {
    if (this.shouldLogLevel('warn')) {
      console.warn(`[${this.context}] ${LogConfig.formats.warning(message)}`);
    }
  }
  
  info(message: string) {
    if (this.shouldLogLevel('info')) {
      console.info(`[${this.context}] ${LogConfig.formats.info(message)}`);
    }
  }
  
  success(message: string) {
    if (this.shouldLogLevel('info')) {
      console.info(`[${this.context}] ${LogConfig.formats.success(message)}`);
    }
  }
  
  debug(message: string, data?: any) {
    if (this.shouldLogLevel('debug')) {
      if (data) {
        console.log(`[${this.context}] ${message}`, data);
      } else {
        console.log(`[${this.context}] ${message}`);
      }
    }
  }
  
  // Special method for feature-specific logs
  feature(feature: keyof typeof LogConfig.features, message: string, data?: any) {
    if (shouldLog(feature) && this.shouldLogLevel('debug')) {
      this.debug(message, data);
    }
  }
}
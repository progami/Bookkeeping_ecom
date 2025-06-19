// Client-side logger that sends logs to server
class ClientLogger {
  private logBuffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private originalConsole: any = {};
  private enabled: boolean = false;
  
  constructor() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Always enable in development - check multiple conditions
    this.enabled = process.env.NODE_ENV === 'development' || 
                   process.env.NODE_ENV !== 'production' ||
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';
    
    // Get the pre-existing log buffer from the early init script
    if ((window as any).__logBuffer && Array.isArray((window as any).__logBuffer)) {
      this.logBuffer = (window as any).__logBuffer;
      console.log('[ClientLogger] Found', this.logBuffer.length, 'pre-existing logs from early init');
    }
    
    // Store original console methods FIRST
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };
    
    // Debug log to see what's happening
    this.originalConsole.log('[ClientLogger] Initialized:', this.enabled ? 'ENABLED' : 'DISABLED');
    
    if (!this.enabled) return;
    
    // Start flush interval
    this.startFlushInterval();
    
    // Intercept console methods (they're already intercepted by init-logger.js, but we take over here)
    this.interceptConsole();
    
    // Immediately flush any pre-existing logs
    if (this.logBuffer.length > 0) {
      setTimeout(() => this.flush(), 100); // Small delay to ensure everything is ready
    }
  }
  
  private interceptConsole() {
    this.originalConsole.log('[ClientLogger] Intercepting console methods...');
    
    // Get stack trace to find caller info
    const getCallerInfo = () => {
      const stack = new Error().stack || '';
      const lines = stack.split('\n');
      // Find the first line that's not from client-logger.ts
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('client-logger') && !line.includes('console.') && line.includes('.js') || line.includes('.tsx') || line.includes('.ts')) {
          // Extract filename and line number
          const match = line.match(/([^\/\s]+\.(tsx?|jsx?|js)):(\d+):(\d+)/);
          if (match) {
            return `${match[1]}:${match[3]}`;
          }
        }
      }
      return '';
    };
    
    // Override console.log
    console.log = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        // Prepend caller info to match browser console format
        this.addToBuffer('log', [caller, ...args]);
      } else {
        this.addToBuffer('log', args);
      }
      this.originalConsole.log(...args);
    };
    
    // Override console.error
    console.error = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('error', [caller, ...args]);
      } else {
        this.addToBuffer('error', args);
      }
      this.originalConsole.error(...args);
    };
    
    // Override console.warn
    console.warn = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('warn', [caller, ...args]);
      } else {
        this.addToBuffer('warn', args);
      }
      this.originalConsole.warn(...args);
    };
    
    // Override console.info
    console.info = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('info', [caller, ...args]);
      } else {
        this.addToBuffer('info', args);
      }
      this.originalConsole.info(...args);
    };
    
    // Override console.debug
    console.debug = (...args: any[]) => {
      const caller = getCallerInfo();
      if (caller) {
        this.addToBuffer('debug', [caller, ...args]);
      } else {
        this.addToBuffer('debug', args);
      }
      this.originalConsole.debug(...args);
    };
  }
  
  private addToBuffer(level: string, args: any[]) {
    // Don't process our own logs to prevent loops
    if (args.length > 0 && typeof args[0] === 'string' && args[0].startsWith('[ClientLogger]')) {
      return;
    }
    
    // Convert args to string message - EXACTLY as they appear in console
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.toString();
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Add to buffer
    this.logBuffer.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
    
    // Debug
    if (this.logBuffer.length === 1 || this.logBuffer.length % 5 === 0) {
      this.originalConsole.log('[ClientLogger] Buffer size:', this.logBuffer.length);
    }
    
    // Flush if buffer is getting large
    if (this.logBuffer.length >= 10) {
      this.flush();
    }
  }
  
  private startFlushInterval() {
    // Flush logs every 2 seconds
    this.flushInterval = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, 2000);
  }
  
  private async flush() {
    if (!this.enabled || this.logBuffer.length === 0) return;
    
    // Copy current buffer and clear it
    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];
    
    // Debug: Log the flush attempt
    this.originalConsole.log('[ClientLogger] Flushing', logsToSend.length, 'logs to server');
    
    try {
      const response = await fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.originalConsole.log('[ClientLogger] Successfully sent logs');
    } catch (error) {
      // Restore logs to buffer if send failed
      this.logBuffer = [...logsToSend, ...this.logBuffer];
      this.originalConsole.error('[ClientLogger] Failed to send logs to server:', error);
    }
  }
  
  // Clean up on page unload
  destroy() {
    if (!this.enabled) return;
    
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush any remaining logs
    this.flush();
  }
}

// Initialize client logger
let clientLogger: ClientLogger | null = null;

export function initializeClientLogger() {
  if (typeof window !== 'undefined' && !clientLogger) {
    clientLogger = new ClientLogger();
    
    // Flush logs on page unload
    window.addEventListener('beforeunload', () => {
      if (clientLogger) {
        clientLogger.destroy();
      }
    });
    
    // Also capture unhandled errors
    window.addEventListener('error', (event) => {
      console.error('Unhandled error:', event.error || event.message);
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
  }
}

export { clientLogger };
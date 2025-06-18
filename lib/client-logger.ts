// Client-side logger that sends logs to server
class ClientLogger {
  private logBuffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private originalConsole: any = {};
  
  constructor() {
    // Only run in browser
    if (typeof window === 'undefined') return;
    
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console)
    };
    
    // Start flush interval
    this.startFlushInterval();
    
    // Intercept console methods
    this.interceptConsole();
  }
  
  private interceptConsole() {
    // Override console.log
    console.log = (...args: any[]) => {
      this.addToBuffer('log', args);
      this.originalConsole.log(...args);
    };
    
    // Override console.error
    console.error = (...args: any[]) => {
      this.addToBuffer('error', args);
      this.originalConsole.error(...args);
    };
    
    // Override console.warn
    console.warn = (...args: any[]) => {
      this.addToBuffer('warn', args);
      this.originalConsole.warn(...args);
    };
    
    // Override console.info
    console.info = (...args: any[]) => {
      this.addToBuffer('info', args);
      this.originalConsole.info(...args);
    };
    
    // Override console.debug
    console.debug = (...args: any[]) => {
      this.addToBuffer('debug', args);
      this.originalConsole.debug(...args);
    };
  }
  
  private addToBuffer(level: string, args: any[]) {
    // Convert args to string message
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    // Skip empty messages
    if (!message.trim()) return;
    
    // Add to buffer
    this.logBuffer.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
    
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
    if (this.logBuffer.length === 0) return;
    
    // Copy current buffer and clear it
    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];
    
    try {
      await fetch('/api/v1/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Restore logs to buffer if send failed
      this.logBuffer = [...logsToSend, ...this.logBuffer];
      this.originalConsole.error('Failed to send logs to server:', error);
    }
  }
  
  // Clean up on page unload
  destroy() {
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
  }
}

export { clientLogger };
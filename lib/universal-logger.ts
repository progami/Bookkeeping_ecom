// Universal logger that works on both client and server

interface LogLevel {
  DEBUG: 'DEBUG';
  INFO: 'INFO';
  WARN: 'WARN';
  ERROR: 'ERROR';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

class UniversalLogger {
  private serverLogger: any = null;

  constructor() {
    // Only load server logger on server side
    if (typeof window === 'undefined') {
      try {
        // Use dynamic import to avoid client-side errors
        const { structuredLogger } = require('./logger');
        this.serverLogger = structuredLogger;
      } catch (e) {
        console.error('Failed to load server logger:', e);
      }
    }
  }

  private formatMessage(level: string, module: string, message: string): string {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    return `[${timestamp}] [${module}] [${level}] - ${message}`;
  }

  private log(level: string, message: string, ...args: any[]) {
    if (typeof window === 'undefined' && this.serverLogger) {
      // Server side - use Winston logger directly (it handles formatting)
      switch (level) {
        case LOG_LEVELS.DEBUG:
          this.serverLogger.debug(message, ...args);
          break;
        case LOG_LEVELS.INFO:
          this.serverLogger.info(message, ...args);
          break;
        case LOG_LEVELS.WARN:
          this.serverLogger.warn(message, ...args);
          break;
        case LOG_LEVELS.ERROR:
          this.serverLogger.error(message, ...args);
          break;
      }
    } else {
      // Client side - use console with formatting
      // Extract module name from message if it follows pattern [Module]
      const moduleMatch = message.match(/^\[([^\]]+)\]/);
      const moduleName = moduleMatch ? moduleMatch[1] : 'App';
      const cleanMessage = moduleMatch ? message.substring(moduleMatch[0].length).trim() : message;
      const formattedMessage = this.formatMessage(level, moduleName, cleanMessage);
      
      switch (level) {
        case LOG_LEVELS.ERROR:
          console.error(formattedMessage, ...args);
          break;
        case LOG_LEVELS.WARN:
          console.warn(formattedMessage, ...args);
          break;
        case LOG_LEVELS.INFO:
          console.info(formattedMessage, ...args);
          break;
        case LOG_LEVELS.DEBUG:
          if (process.env.NODE_ENV === 'development') {
            console.log(formattedMessage, ...args);
          }
          break;
      }
    }
  }

  debug(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.WARN, message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log(LOG_LEVELS.ERROR, message, ...args);
  }
}

// Export singleton instance
export const universalLogger = new UniversalLogger();

// Also export as structuredLogger for compatibility
export { universalLogger as structuredLogger };
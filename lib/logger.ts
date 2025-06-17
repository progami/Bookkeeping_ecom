import winston from 'winston';
import crypto from 'crypto';
import { sanitizeObject, sanitizeString } from './log-sanitizer';

// Conditionally import DailyRotateFile only in Node.js runtime
let DailyRotateFile: any;
if (typeof window === 'undefined') {
  try {
    DailyRotateFile = require('winston-daily-rotate-file');
  } catch (e) {
    // Silently ignore in edge runtime
  }
}

// Custom format that sanitizes sensitive data
const sanitizeFormat = winston.format((info) => {
  // Create a new WeakSet for each log entry to track visited objects
  const visited = new WeakSet();
  
  // Sanitize the message
  if (typeof info.message === 'string') {
    info.message = sanitizeString(info.message);
  }
  
  // Sanitize metadata
  if (info.metadata) {
    info.metadata = sanitizeObject(info.metadata, visited);
  }
  
  // Sanitize any additional properties
  const sanitized = { ...info };
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && key !== 'level' && key !== 'timestamp') {
      sanitized[key] = sanitizeObject(sanitized[key], visited);
    }
  });
  
  return sanitized;
});

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Define format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  sanitizeFormat(),
  winston.format.json()
);

// Define transports
const transports: winston.transport[] = [];

// Console transport (development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(
          (info) => {
            // Use concise format - no timestamp in dev
            const level = info.level.includes('error') ? '❌' : 
                         info.level.includes('warn') ? '⚠️ ' : 
                         info.level.includes('info') ? 'ℹ️ ' : '';
            return `${level} ${info.message}`;
          }
        )
      ),
    })
  );
}

// File transports (production) - only if DailyRotateFile is available
if (process.env.NODE_ENV === 'production' && DailyRotateFile) {
  try {
    // Error log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d',
        format,
      })
    );

    // Combined log file
    transports.push(
      new DailyRotateFile({
        filename: 'logs/combined-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format,
      })
    );
  } catch (e) {
    // Silently ignore if file transport fails
  }
}

// Create logger instance
// Only add file handlers in Node.js runtime, not edge runtime
const createLogger = () => {
  const config: winston.LoggerOptions = {
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format,
    transports,
  };

  // Only add file handlers if we're in Node.js runtime
  if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    try {
      config.exceptionHandlers = [
        new winston.transports.File({ filename: 'logs/exceptions.log' }),
      ];
      config.rejectionHandlers = [
        new winston.transports.File({ filename: 'logs/rejections.log' }),
      ];
    } catch (e) {
      // Silently ignore if file transport fails (edge runtime)
    }
  }

  return winston.createLogger(config);
};

const logger = createLogger();

// Create request logger middleware
export function requestLogger(req: any, res: any, next: any) {
  // Skip logging for static assets and health checks
  if (req.url.includes('_next') || req.url.includes('/health') || req.url.includes('/favicon')) {
    return next();
  }
  
  const start = Date.now();
  
  // Only log response, not request (reduces noise)
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 500 ? '❌' : status >= 400 ? '⚠️ ' : '✅';
    
    // Only log slow requests in success cases
    if (status < 400 && duration < 500) {
      return; // Skip fast successful requests
    }
    
    logger.http({
      message: `${emoji} ${req.method} ${req.url} → ${status} (${duration}ms)`,
    });
  });
  
  next();
}

// Export logger with context methods
export class Logger {
  private context: any = {};

  constructor(context?: any) {
    this.context = context || {};
  }

  private log(level: string, message: string, meta?: any) {
    logger.log(level, message, { ...this.context, ...meta });
  }

  error(message: string, error?: any, meta?: any) {
    this.log('error', message, { error: error?.stack || error, ...meta });
  }

  warn(message: string, meta?: any) {
    this.log('warn', message, meta);
  }

  info(message: string, meta?: any) {
    this.log('info', message, meta);
  }

  http(message: string, meta?: any) {
    this.log('http', message, meta);
  }

  debug(message: string, meta?: any) {
    this.log('debug', message, meta);
  }

  child(context: any) {
    return new Logger({ ...this.context, ...context });
  }
}

// Create default logger instance
export const structuredLogger = new Logger();

// Export winston logger instance for advanced usage
export const winstonLogger = logger;
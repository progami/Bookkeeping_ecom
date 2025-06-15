import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import crypto from 'crypto';
import { sanitizeObject, sanitizeString } from './log-sanitizer';

// Custom format that sanitizes sensitive data
const sanitizeFormat = winston.format((info) => {
  // Sanitize the message
  if (typeof info.message === 'string') {
    info.message = sanitizeString(info.message);
  }
  
  // Sanitize metadata
  if (info.metadata) {
    info.metadata = sanitizeObject(info.metadata);
  }
  
  // Sanitize any additional properties
  const sanitized = { ...info };
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && key !== 'level' && key !== 'timestamp') {
      sanitized[key] = sanitizeObject(sanitized[key]);
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
          (info) => `${info.timestamp} [${info.level}]: ${info.message}`
        )
      ),
    })
  );
}

// File transports (production)
if (process.env.NODE_ENV === 'production') {
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
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
  ],
});

// Create request logger middleware
export function requestLogger(req: any, res: any, next: any) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  
  // Log request
  logger.http({
    message: `${req.method} ${req.url}`,
    method: req.method,
    url: req.url,
    ip: req.ip,
    requestId,
    userAgent: req.headers['user-agent'],
  });
  
  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http({
      message: `${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId,
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

// Export winston instance for advanced usage
export { winston as winstonLogger };
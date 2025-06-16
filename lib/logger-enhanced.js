"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.winstonLogger = exports.structuredLogger = exports.Logger = void 0;
exports.requestLogger = requestLogger;
exports.captureConsoleOutput = captureConsoleOutput;
const winston_1 = require("winston");
const winston_daily_rotate_file_1 = require("winston-daily-rotate-file");
const crypto_1 = require("crypto");
const log_sanitizer_1 = require("./log-sanitizer");
const fs_1 = require("fs");
const path_1 = require("path");
// Ensure logs directory exists
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// Custom format that sanitizes sensitive data
const sanitizeFormat = winston_1.default.format((info) => {
    const visited = new WeakSet();
    if (typeof info.message === 'string') {
        info.message = (0, log_sanitizer_1.sanitizeString)(info.message);
    }
    if (info.metadata) {
        info.metadata = (0, log_sanitizer_1.sanitizeObject)(info.metadata, visited);
    }
    const sanitized = { ...info };
    Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object' && key !== 'level' && key !== 'timestamp') {
            sanitized[key] = (0, log_sanitizer_1.sanitizeObject)(sanitized[key], visited);
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
winston_1.default.addColors(colors);
// Create timestamp for log file
const getLogFilename = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `app-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.log`;
};
// Define format for file output
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), sanitizeFormat(), winston_1.default.format.json());
// Define format for console output
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => {
    const { timestamp, level, message, requestId, ...meta } = info;
    let log = `${timestamp} [${level}]`;
    if (requestId) {
        log += ` [${requestId}]`;
    }
    log += `: ${message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
}));
// Define transports
const transports = [];
// Always add console transport
transports.push(new winston_1.default.transports.Console({
    format: consoleFormat,
}));
// Add file transports
const sessionLogFile = path_1.default.join(logsDir, getLogFilename());
// Session log file (created on startup)
transports.push(new winston_1.default.transports.File({
    filename: sessionLogFile,
    format: fileFormat,
}));
// Error log file (rotating)
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '30d',
    format: fileFormat,
}));
// Combined log file (rotating)
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '50m',
    maxFiles: '7d',
    format: fileFormat,
}));
// HTTP request log file (rotating)
transports.push(new winston_daily_rotate_file_1.default({
    filename: path_1.default.join(logsDir, 'http-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'http',
    maxSize: '50m',
    maxFiles: '3d',
    format: fileFormat,
}));
// Create logger instance
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    levels,
    format: fileFormat,
    transports,
    exceptionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'exceptions.log'),
            format: fileFormat,
        }),
    ],
    rejectionHandlers: [
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'rejections.log'),
            format: fileFormat,
        }),
    ],
});
// Store for request contexts
const requestContexts = new Map();
// Enhanced request logger middleware
function requestLogger(req, res, next) {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || crypto_1.default.randomUUID();
    // Store request ID in headers for downstream use
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    // Store request context
    const context = {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        timestamp: new Date().toISOString(),
    };
    requestContexts.set(requestId, context);
    // Log request with body if present
    const logData = {
        message: `⟵ ${req.method} ${req.url}`,
        ...context,
        requestId,
    };
    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
        logData.body = req.body;
    }
    logger.http(logData);
    // Capture response
    const originalSend = res.send;
    let responseBody;
    res.send = function (data) {
        responseBody = data;
        return originalSend.call(this, data);
    };
    // Log response on finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const responseLog = {
            message: `⟶ ${req.method} ${req.url} ${res.statusCode} ${duration}ms`,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            requestId,
        };
        // Add response body for non-200 status codes or if debug level
        if (res.statusCode >= 400 || logger.level === 'debug') {
            try {
                if (responseBody && typeof responseBody === 'string') {
                    responseLog.response = JSON.parse(responseBody);
                }
            }
            catch (e) {
                // If not JSON, include as is
                if (responseBody && responseBody.length < 1000) {
                    responseLog.response = responseBody;
                }
            }
        }
        // Log with appropriate level based on status code
        if (res.statusCode >= 500) {
            logger.error(responseLog);
        }
        else if (res.statusCode >= 400) {
            logger.warn(responseLog);
        }
        else {
            logger.http(responseLog);
        }
        // Clean up context after a delay
        setTimeout(() => {
            requestContexts.delete(requestId);
        }, 60000); // Keep for 1 minute
    });
    // Attach logger to request for use in handlers
    req.logger = new Logger({ requestId });
    next();
}
// Export logger with context methods
class Logger {
    constructor(context) {
        this.context = {};
        this.context = context || {};
    }
    log(level, message, meta) {
        const logData = {
            message,
            ...this.context,
            ...meta,
        };
        // If we have a requestId, try to get the request context
        if (this.context.requestId) {
            const requestContext = requestContexts.get(this.context.requestId);
            if (requestContext) {
                logData.request = requestContext;
            }
        }
        logger.log(level, logData);
    }
    error(message, error, meta) {
        const errorData = { ...meta };
        if (error) {
            if (error instanceof Error) {
                errorData.error = {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                };
            }
            else {
                errorData.error = error;
            }
        }
        this.log('error', message, errorData);
    }
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    info(message, meta) {
        this.log('info', message, meta);
    }
    http(message, meta) {
        this.log('http', message, meta);
    }
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    child(context) {
        return new Logger({ ...this.context, ...context });
    }
    // Log API calls with full details
    api(method, endpoint, data) {
        const apiLog = {
            api: {
                method,
                endpoint,
                timestamp: new Date().toISOString(),
            },
        };
        if (data) {
            if (data.params)
                apiLog.api.params = data.params;
            if (data.body)
                apiLog.api.body = data.body;
            if (data.response)
                apiLog.api.response = data.response;
            if (data.error)
                apiLog.api.error = data.error;
            if (data.duration)
                apiLog.api.duration = data.duration;
        }
        this.log('info', `API ${method} ${endpoint}`, apiLog);
    }
}
exports.Logger = Logger;
// Create default logger instance
exports.structuredLogger = new Logger();
// Export winston logger instance for advanced usage
exports.winstonLogger = logger;
// Console output capture for server.js
function captureConsoleOutput() {
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
    };
    console.log = (...args) => {
        originalConsole.log(...args);
        logger.info(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), { source: 'console.log' });
    };
    console.error = (...args) => {
        originalConsole.error(...args);
        logger.error(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), { source: 'console.error' });
    };
    console.warn = (...args) => {
        originalConsole.warn(...args);
        logger.warn(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), { source: 'console.warn' });
    };
    console.info = (...args) => {
        originalConsole.info(...args);
        logger.info(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), { source: 'console.info' });
    };
}
// Log startup information
logger.info('='.repeat(80));
logger.info(`Logging session started: ${sessionLogFile}`);
logger.info(`Process ID: ${process.pid}`);
logger.info(`Node Version: ${process.version}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Log Level: ${logger.level}`);
logger.info('='.repeat(80));

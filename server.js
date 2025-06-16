const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

// Initialize enhanced logging before anything else
const { captureConsoleOutput, structuredLogger, requestLogger } = require('./lib/logger-enhanced-compiled');

// Capture all console output to log files
captureConsoleOutput();

// Log server startup
const logger = structuredLogger.child({ component: 'server' });
logger.info('Starting Next.js server...');

// Suppress deprecation warning for url.parse
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('url.parse')) {
    return; // Ignore url.parse deprecation warnings
  }
  logger.warn('Process warning', { warning: warning.toString() });
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Configure the Next.js app
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
};

logger.info('Preparing Next.js app...', { dev, hostname, port });

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
      // Apply request logging middleware
      requestLogger(req, res, async () => {
        try {
          // Handle Next.js static files and hot reloading
          if (pathname.startsWith('/_next') || pathname.startsWith('/__nextjs')) {
            await handle(req, res, parsedUrl);
          } else {
            // Add small delay for initial page loads in dev mode to ensure bundles are ready
            if (dev && !req.headers.referer) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            await handle(req, res, parsedUrl);
          }
        } catch (err) {
          const reqLogger = req.logger || logger;
          reqLogger.error('Request handler error', err, {
            url: req.url,
            method: req.method,
            pathname,
          });
          res.statusCode = 500;
          res.end('Internal server error');
        }
      });
    } catch (err) {
      logger.error('Server error', err, {
        url: req.url,
        method: req.method,
      });
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, (err) => {
    if (err) {
      logger.error('Failed to start server', err);
      throw err;
    }
    logger.info(`✓ Server ready at https://${hostname}:${port}`);
    logger.info('='.repeat(80));
  });
}).catch((err) => {
  logger.error('Failed to prepare Next.js app', err);
  process.exit(1);
});
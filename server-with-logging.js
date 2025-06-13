const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Configure the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates/localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates/localhost-cert.pem')),
};

// Create a write stream for logging
const logFile = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Helper function to log to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(message);
  logStream.write(logMessage + '\n');
}

// Override console methods to also write to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  originalConsoleLog.apply(console, args);
  logStream.write(`[${timestamp}] ${message}\n`);
};

console.error = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  originalConsoleError.apply(console, args);
  logStream.write(`[${timestamp}] [ERROR] ${message}\n`);
};

console.warn = function(...args) {
  const message = args.join(' ');
  const timestamp = new Date().toISOString();
  originalConsoleWarn.apply(console, args);
  logStream.write(`[${timestamp}] [WARN] ${message}\n`);
};

// Log server start
log('Starting server...');

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, () => {
    console.log(`> Server listening at https://${hostname}:${port}`);
  });
});

// Handle process termination
process.on('SIGINT', () => {
  log('Server shutting down...');
  logStream.end();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  logStream.end();
  process.exit(1);
});
const { createServer } = require('https');
const fs = require('fs');
const path = require('path');
const util = require('util');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a new log file for this session
const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const logFilePath = path.join(logsDir, `app-${sessionTimestamp}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

// Add timestamp to all console methods and write to file
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Helper to write to both console and file
const writeLog = (level, originalMethod, args) => {
  const timestamp = getTimestamp();
  
  // Write to console with timestamp
  originalMethod(`[${timestamp}]`, ...args);
  
  // Write to file
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        // Handle circular references
        return util.inspect(arg, { depth: 2, colors: false });
      }
    }
    return String(arg);
  }).join(' ');
  logStream.write(`[${timestamp}] [${level}] ${message}\n`);
};

console.log = (...args) => writeLog('info', originalLog, args);
console.error = (...args) => writeLog('error', originalError, args);
console.warn = (...args) => writeLog('warn', originalWarn, args);
console.info = (...args) => writeLog('info', originalInfo, args);

// Log session start
console.log('='.repeat(80));
console.log(`Server session started. Logs: ${logFilePath}`);
console.log('='.repeat(80));

// Suppress deprecation warning for url.parse
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('url.parse')) {
    return; // Ignore url.parse deprecation warnings
  }
  console.warn(warning);
});

const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Configure the Next.js app - don't pass hostname/port when using custom server
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('localhost-key.pem'),
  cert: fs.readFileSync('localhost.pem')
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
      // Log requests (excluding static assets)
      if (!pathname.startsWith('/_next') && !pathname.startsWith('/__nextjs') && !pathname.includes('.')) {
        console.log(`${req.method} ${req.url}`);
      }
      
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
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Server listening at https://${hostname}:${port}`);
  });
});
const { createServer } = require('https');

// Add timestamp to all console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

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

console.log = (...args) => {
  originalLog(`[${getTimestamp()}]`, ...args);
};

console.error = (...args) => {
  originalError(`[${getTimestamp()}]`, ...args);
};

console.warn = (...args) => {
  originalWarn(`[${getTimestamp()}]`, ...args);
};

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
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Configure the Next.js app - don't pass hostname/port when using custom server
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost+2.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
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
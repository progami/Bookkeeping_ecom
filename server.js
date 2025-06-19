const { createServer } = require('https');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Clear development log file on server start
if (dev) {
  const logsDir = path.join(__dirname, 'logs');
  const devLogPath = path.join(logsDir, 'development.log');
  
  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Clear the development log file
  try {
    fs.writeFileSync(devLogPath, '');
    console.log('Development log file cleared on server start');
  } catch (error) {
    // Ignore error if file doesn't exist or can't be written
  }
}

// Configure Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// SSL certificate configuration
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost.pem'))
};

app.prepare().then(async () => {
  // Initialize queue workers in development
  if (dev) {
    try {
      // Queue workers will be initialized by Next.js when it loads the app
      console.log('Queue workers will be initialized by Next.js');
    } catch (error) {
      console.error('Failed to initialize queue workers:', error);
      // Continue running without workers
    }
  }
  
  createServer(httpsOptions, async (req, res) => {
    try {
      // Use WHATWG URL API instead of deprecated url.parse()
      const baseURL = `https://${hostname}:${port}`;
      const parsedUrl = new URL(req.url, baseURL);
      
      // Convert to Next.js expected format
      const urlObject = {
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams)
      };
      
      await handle(req, res, urlObject);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
    });
    
  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
  });
});
const { createServer } = require('https');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3003;

// Configure Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// SSL certificate configuration
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certificates', 'localhost.pem'))
};

app.prepare().then(() => {
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
});
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Generate self-signed certificate for local development
const https = require('https');
const forge = require('node-forge');

function generateSelfSignedCertificate() {
  const pki = forge.pki;
  
  // Generate a keypair
  const keys = pki.rsa.generateKeyPair(2048);
  
  // Create a certificate
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'US'
  }, {
    shortName: 'ST',
    value: 'Test'
  }, {
    name: 'localityName',
    value: 'Test'
  }, {
    name: 'organizationName',
    value: 'Test'
  }, {
    shortName: 'OU',
    value: 'Test'
  }];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{
    name: 'basicConstraints',
    cA: true
  }, {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true
  }, {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true
  }, {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true
  }, {
    name: 'subjectAltName',
    altNames: [{
      type: 2, // DNS
      value: 'localhost'
    }, {
      type: 7, // IP
      ip: '127.0.0.1'
    }]
  }]);
  
  // Sign the certificate
  cert.sign(keys.privateKey);
  
  return {
    key: pki.privateKeyToPem(keys.privateKey),
    cert: pki.certificateToPem(cert)
  };
}

const PORT = process.env.PORT || 3003;

app.prepare().then(() => {
  let httpsOptions;
  
  const certPath = path.join(__dirname, 'localhost.crt');
  const keyPath = path.join(__dirname, 'localhost.key');
  
  // Check if certificates exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } else {
    // Generate self-signed certificate
    console.log('Generating self-signed certificate for localhost...');
    const { key, cert } = generateSelfSignedCertificate();
    
    // Save the certificate and key
    fs.writeFileSync(keyPath, key);
    fs.writeFileSync(certPath, cert);
    
    httpsOptions = { key, cert };
  }
  
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://localhost:${PORT}`);
    console.log('> Using self-signed certificate for local development');
    console.log('> You may need to accept the certificate warning in your browser');
  });
});
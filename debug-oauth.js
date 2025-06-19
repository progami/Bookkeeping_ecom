// Debug script to understand the OAuth flow
const { XeroClient } = require('xero-node');

console.log('Checking XeroClient methods...');
const client = new XeroClient({
  clientId: 'dummy',
  clientSecret: 'dummy',
  redirectUris: ['https://localhost:3003/api/v1/xero/auth/callback'],
  scopes: ['openid', 'profile', 'email', 'offline_access']
});

// Log available methods
console.log('\nXeroClient prototype methods:');
const proto = Object.getPrototypeOf(client);
const methods = Object.getOwnPropertyNames(proto).filter(name => typeof proto[name] === 'function');
methods.forEach(method => {
  if (method.includes('api') || method.includes('Callback') || method.includes('pkce') || method.includes('verifier')) {
    console.log(`- ${method}`);
  }
});

// Check if there's a way to set code_verifier
console.log('\nChecking for PKCE-related properties:');
const allProps = Object.getOwnPropertyNames(client);
allProps.forEach(prop => {
  if (prop.toLowerCase().includes('pkce') || prop.toLowerCase().includes('verifier') || prop.toLowerCase().includes('challenge')) {
    console.log(`- ${prop}: ${typeof client[prop]}`);
  }
});
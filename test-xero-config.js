#!/usr/bin/env node

// Test Xero configuration
const config = {
  clientId: process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUri: process.env.XERO_REDIRECT_URI || 'http://localhost:3003/api/v1/xero/auth/callback',
  scopes: 'accounting.transactions accounting.settings offline_access'
};

console.log('Xero Configuration Check:');
console.log('========================');
console.log(`Client ID: ${config.clientId ? '✓ Set' : '✗ Missing'}`);
console.log(`Client Secret: ${config.clientSecret ? '✓ Set' : '✗ Missing'}`);
console.log(`Redirect URI: ${config.redirectUri}`);
console.log(`Scopes: ${config.scopes}`);

if (!config.clientId || !config.clientSecret) {
  console.log('\n⚠️  Missing Xero credentials!');
  console.log('\nTo set up Xero authentication:');
  console.log('1. Go to https://developer.xero.com/myapps');
  console.log('2. Create a new app (or use existing)');
  console.log('3. Add redirect URI: http://localhost:3003/api/v1/xero/auth/callback');
  console.log('4. Copy Client ID and Client Secret');
  console.log('5. Create .env.local file with:');
  console.log('   XERO_CLIENT_ID=your_client_id');
  console.log('   XERO_CLIENT_SECRET=your_client_secret');
} else {
  console.log('\n✓ Xero credentials are configured!');
  console.log('\nTo authenticate:');
  console.log('1. Visit http://localhost:3003/bookkeeping');
  console.log('2. Click "Connect Xero" button');
  console.log('3. Log in to Xero and approve access');
}
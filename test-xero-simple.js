// Use native fetch in Node.js 18+
const { XeroClient } = require('xero-node');

const CLIENT_ID = '781184D1AD314CB6989EB8D2291AB453';
const CLIENT_SECRET = '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg';
const REDIRECT_URI = 'http://localhost:3003/api/v1/xero/auth/callback';

async function testXeroSDKFlow() {
  console.log('Testing Xero SDK OAuth flow...\n');
  
  // Step 1: Create and initialize Xero client
  const xero = new XeroClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [REDIRECT_URI],
    scopes: ['accounting.transactions', 'accounting.settings', 'offline_access']
  });
  
  console.log('Initializing Xero client...');
  await xero.initialize();
  console.log('✅ Xero client initialized');
  console.log('OpenID client:', xero.openIdClient ? 'Present' : 'Missing');
  
  // Step 2: Generate authorization URL with state
  const state = 'test_state_' + Date.now();
  console.log('\nGenerating auth URL with state:', state);
  
  // The buildConsentUrl doesn't accept state, we need to add it manually
  let authUrl = await xero.buildConsentUrl();
  const url = new URL(authUrl);
  url.searchParams.append('state', state);
  authUrl = url.toString();
  
  console.log('Authorization URL:', authUrl);
  
  // Step 3: Simulate callback with test code
  console.log('\nSimulating OAuth callback...');
  const testCode = 'test_auth_code_123';
  const callbackUrl = `${REDIRECT_URI}?code=${testCode}&state=${state}`;
  
  console.log('Callback URL:', callbackUrl);
  
  // Step 4: Test apiCallback with proper state
  console.log('\nTesting apiCallback with state parameter...');
  
  try {
    // This is how apiCallback should be called
    const checks = { state: state };
    console.log('Calling apiCallback with checks:', checks);
    
    // This will fail with test code, but shows the correct usage
    const tokenSet = await xero.apiCallback(callbackUrl, checks);
    console.log('Token set:', tokenSet);
  } catch (error) {
    console.log('\nExpected error (test code is invalid):', error.message);
    
    // The important thing is that we don't get "checks.state argument is missing"
    if (error.message.includes('checks.state argument is missing')) {
      console.error('❌ State parameter not passed correctly!');
    } else {
      console.log('✅ State parameter passed correctly!');
      console.log('   (Token exchange failed as expected with test code)');
    }
  }
  
  // Step 5: Test manual token exchange
  console.log('\n\nTesting manual token exchange...');
  const tokenUrl = 'https://identity.xero.com/connect/token';
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: testCode,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });
  
  console.log('Token request params:', params.toString());
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });
    
    const responseText = await response.text();
    console.log('\nToken exchange response:', response.status);
    console.log('Response:', responseText);
  } catch (error) {
    console.error('Token exchange error:', error.message);
  }
}

// Run the test
testXeroSDKFlow().catch(console.error);
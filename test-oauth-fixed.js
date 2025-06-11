const { XeroClient } = require('xero-node');

const CLIENT_ID = '781184D1AD314CB6989EB8D2291AB453';
const CLIENT_SECRET = '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg';
const REDIRECT_URI = 'http://localhost:3003/api/v1/xero/auth/callback';

async function testFixedOAuth() {
  console.log('Testing fixed OAuth implementation...\n');
  
  // Step 1: Create Xero client with state
  const state = 'test_state_' + Date.now();
  console.log('Creating Xero client with state:', state);
  
  const xero = new XeroClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [REDIRECT_URI],
    scopes: ['accounting.transactions', 'accounting.settings', 'offline_access'],
    state: state  // State is now part of the config
  });
  
  console.log('Initializing Xero client...');
  await xero.initialize();
  console.log('✅ Xero client initialized with state in config');
  
  // Step 2: Build consent URL
  const authUrl = await xero.buildConsentUrl();
  console.log('\nAuthorization URL:', authUrl);
  
  // Check if state is included
  const url = new URL(authUrl);
  const urlState = url.searchParams.get('state');
  console.log('State in URL:', urlState);
  console.log('State matches:', urlState === state ? '✅ Yes' : '❌ No');
  
  // Step 3: Simulate callback
  const testCode = 'test_code_123';
  const callbackUrl = `${REDIRECT_URI}?code=${testCode}&state=${state}`;
  
  console.log('\nSimulating callback...');
  console.log('Callback URL:', callbackUrl);
  
  try {
    // Now apiCallback should work with just the URL
    console.log('\nCalling apiCallback with URL only...');
    const tokenSet = await xero.apiCallback(callbackUrl);
    console.log('✅ Success! Token set:', tokenSet);
  } catch (error) {
    console.log('\nError:', error.message);
    
    // Check if it's the state error
    if (error.message.includes('checks.state argument is missing')) {
      console.error('❌ FAILED: State parameter still not working correctly');
    } else if (error.message.includes('invalid_grant') || error.message.includes('invalid authorization code')) {
      console.log('✅ SUCCESS: State validation passed! (Token exchange failed as expected with test code)');
    } else {
      console.log('⚠️  Unexpected error:', error.message);
    }
  }
}

// Run the test
testFixedOAuth().catch(console.error);
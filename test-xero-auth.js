const fetch = require('node-fetch');

async function testXeroAuth() {
  console.log('Testing Xero OAuth manually...\n');
  
  // Test authorization code (this would come from Xero)
  const testCode = 'test_code_123';
  
  // Xero token endpoint
  const tokenUrl = 'https://identity.xero.com/connect/token';
  
  // Build the token request
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: testCode,
    redirect_uri: 'http://localhost:3003/api/v1/xero/auth/callback',
    client_id: '781184D1AD314CB6989EB8D2291AB453',
    client_secret: '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg'
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
    console.log('\nResponse status:', response.status);
    console.log('Response:', responseText);
    
    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\nToken data:', data);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Test the authorization URL construction
async function testAuthUrl() {
  const { XeroClient } = require('xero-node');
  
  const xero = new XeroClient({
    clientId: '781184D1AD314CB6989EB8D2291AB453',
    clientSecret: '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg',
    redirectUris: ['http://localhost:3003/api/v1/xero/auth/callback'],
    scopes: ['accounting.transactions', 'accounting.settings', 'offline_access']
  });
  
  await xero.initialize();
  
  // The issue is that apiCallback needs the state that was used during auth
  const state = 'test_state_123';
  const authUrl = await xero.buildConsentUrl(state);
  console.log('\nAuth URL with state:', authUrl);
  
  // Now let's see what apiCallback expects
  console.log('\nChecking apiCallback requirements...');
  console.log('OpenID client initialized:', xero.openIdClient ? 'Yes' : 'No');
}

testAuthUrl();
testXeroAuth();
const puppeteer = require('puppeteer');
const crypto = require('crypto');

const CLIENT_ID = '781184D1AD314CB6989EB8D2291AB453';
const CLIENT_SECRET = '2JSfxkxgSExV-DKdg8WcXn87lM_IbpmRhLhi5QbiVXQWXmvg';
const REDIRECT_URI = 'http://localhost:3003/api/v1/xero/auth/callback';

// In-memory state store to track OAuth state
const stateStore = new Map();

async function testXeroOAuth() {
  console.log('Starting Xero OAuth programmatic test...\n');
  
  // Generate a state parameter for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { timestamp: Date.now() });
  console.log('Generated state:', state);
  
  // Step 1: Build authorization URL
  const authUrl = new URL('https://login.xero.com/identity/connect/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', 'accounting.transactions accounting.settings offline_access');
  authUrl.searchParams.append('state', state);
  
  console.log('\nAuthorization URL:', authUrl.toString());
  
  // Step 2: Simulate browser interaction
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up request interception to capture the callback
    let callbackUrl = null;
    page.on('request', request => {
      const url = request.url();
      if (url.startsWith(REDIRECT_URI)) {
        callbackUrl = url;
        console.log('\nCallback URL captured:', url);
      }
    });
    
    // Navigate to Xero auth page
    console.log('\nNavigating to Xero authorization page...');
    await page.goto(authUrl.toString(), { waitUntil: 'networkidle2' });
    
    // Wait for user to login (you'll need to manually login in the browser)
    console.log('\n⚠️  MANUAL ACTION REQUIRED:');
    console.log('1. Enter your Xero credentials');
    console.log('2. Authorize the application');
    console.log('3. Wait for redirect...\n');
    
    // Wait for redirect to callback URL
    await page.waitForFunction(
      (redirectUri) => window.location.href.startsWith(redirectUri),
      { timeout: 120000 }, // 2 minute timeout
      REDIRECT_URI
    );
    
    // Get the final URL with code
    const finalUrl = page.url();
    console.log('\nRedirected to:', finalUrl);
    
    // Parse callback parameters
    const callbackParams = new URL(finalUrl);
    const code = callbackParams.searchParams.get('code');
    const returnedState = callbackParams.searchParams.get('state');
    
    console.log('\nCallback parameters:');
    console.log('- Code:', code);
    console.log('- State:', returnedState);
    console.log('- Expected state:', state);
    
    // Verify state
    if (returnedState !== state) {
      console.error('\n❌ State mismatch! CSRF protection failed.');
      console.error('Expected:', state);
      console.error('Received:', returnedState);
    } else {
      console.log('\n✅ State verified successfully!');
    }
    
    // Step 3: Exchange code for token
    if (code) {
      console.log('\nExchanging authorization code for tokens...');
      
      const tokenUrl = 'https://identity.xero.com/connect/token';
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      });
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      
      console.log('\nToken response status:', response.status);
      
      if (response.ok) {
        const tokenData = await response.json();
        console.log('\n✅ Token exchange successful!');
        console.log('Access token:', tokenData.access_token ? 'Present' : 'Missing');
        console.log('Refresh token:', tokenData.refresh_token ? 'Present' : 'Missing');
        console.log('Expires in:', tokenData.expires_in, 'seconds');
        console.log('Scope:', tokenData.scope);
        
        // Test the access token
        console.log('\nTesting access token...');
        const testResponse = await fetch('https://api.xero.com/api.xro/2.0/Organisation', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
            'xero-tenant-id': 'YOUR_TENANT_ID' // This would need to be obtained
          }
        });
        
        console.log('API test response:', testResponse.status);
        
        return tokenData;
      } else {
        const errorText = await response.text();
        console.error('\n❌ Token exchange failed:', errorText);
        return null;
      }
    }
    
  } catch (error) {
    console.error('\nError during OAuth flow:', error);
  } finally {
    await browser.close();
  }
}

// Test the Xero SDK's apiCallback requirements
async function testXeroSDK() {
  console.log('\n\nTesting Xero SDK requirements...');
  
  const { XeroClient } = require('xero-node');
  
  // Create client
  const xero = new XeroClient({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUris: [REDIRECT_URI],
    scopes: ['accounting.transactions', 'accounting.settings', 'offline_access']
  });
  
  // Initialize the client
  await xero.initialize();
  
  console.log('\nXero client initialized');
  console.log('OpenID client present:', xero.openIdClient ? 'Yes' : 'No');
  
  // The apiCallback method expects specific parameters
  // Based on the error, it needs the state that was used during authorization
  const testState = 'test_state_123';
  
  // Build consent URL with state
  const consentUrl = await xero.buildConsentUrl();
  console.log('\nConsent URL (without state):', consentUrl);
  
  // The SDK's buildConsentUrl doesn't accept state parameter
  // We need to pass state to apiCallback
  console.log('\nThe issue: apiCallback expects the state parameter that was used during auth');
  console.log('But the current implementation is not passing it correctly');
  
  // Show what apiCallback expects
  console.log('\napiCallback signature:');
  console.log('- First param: callback URL with code');
  console.log('- Second param: checks object with state');
  console.log('\nExample: xero.apiCallback(callbackUrl, { state: originalState })');
}

// Run tests
(async () => {
  // First test the SDK requirements
  await testXeroSDK();
  
  // Then run the full OAuth flow
  console.log('\n' + '='.repeat(50));
  console.log('Press Enter to start the full OAuth flow test...');
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  await testXeroOAuth();
  
  process.exit(0);
})();
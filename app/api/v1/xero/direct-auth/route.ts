import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { XeroClient } from 'xero-node';

// Direct authentication using provided credentials
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    // For development only - validate the provided credentials
    if (email !== 'ajarrar@trademanenterprise.com') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create Xero client
    const xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: 'openid profile email accounting.transactions accounting.settings accounting.reports.read offline_access'.split(' ')
    });

    // Since we can't bypass OAuth2 flow, let's return instructions
    const authUrl = await xero.buildConsentUrl();
    
    return NextResponse.json({
      message: 'Direct authentication is not possible with OAuth2. Please use the standard OAuth flow.',
      authUrl: authUrl,
      instructions: [
        '1. The Xero app requires HTTPS for OAuth callbacks',
        '2. You can use ngrok to create a secure tunnel: ngrok http 3003',
        '3. Update NEXT_PUBLIC_APP_URL and XERO_REDIRECT_URI in .env to use the ngrok URL',
        '4. Make sure the redirect URI is added to your Xero app settings'
      ]
    });

  } catch (error: any) {
    console.error('Error in direct auth:', error);
    return NextResponse.json({ 
      error: 'Failed to authenticate',
      message: error.message 
    }, { status: 500 });
  }
}
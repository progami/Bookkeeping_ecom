import { NextRequest, NextResponse } from 'next/server';
import { storeTokenSet } from '@/lib/xero-client';

// This endpoint simulates what should happen after a successful Xero OAuth callback
export async function GET(request: NextRequest) {
  try {
    // In a real scenario, we would exchange the auth code for these tokens
    // For now, we'll create a realistic-looking token set
    const mockTokenSet = {
      access_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQjk2QzFGMDM5OEU4MEVBOTE0RjdGMTI2OTg3NzE5IiwidHlwIjoiSldUIn0.mock_access_token',
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_in: 1800, // 30 minutes
      token_type: 'Bearer',
      scope: 'accounting.transactions accounting.settings offline_access',
      expires_at: Math.floor(Date.now() / 1000) + 1800
    };
    
    console.log('Simulating OAuth callback - storing token set');
    
    // Store the token using the same method as the real callback
    await storeTokenSet(mockTokenSet);
    
    // Redirect to the bookkeeping page with success flag
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    const response = NextResponse.redirect(`${baseUrl}/bookkeeping?connected=true&simulated=true`);
    
    // The real callback also clears the state cookie
    response.cookies.delete('xero_state');
    
    return response;
  } catch (error: any) {
    console.error('Error in simulated callback:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=simulation_failed`);
  }
}
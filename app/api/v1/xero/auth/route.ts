import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';
import { stateStore, cleanupStates } from '@/lib/oauth-state';

export async function GET(request: NextRequest) {
  try {
    // Clean up old states
    cleanupStates();
    
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Store state in memory
    stateStore.set(state, { timestamp: Date.now() });
    
    // Get the authorization URL
    const authUrl = await getAuthUrl(state);
    
    // Also try to store state in cookie as backup
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('xero_state', state, {
      httpOnly: true,
      secure: false, // Set to false for local development
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    console.log('OAuth initiated with state:', state);
    console.log('States in memory:', Array.from(stateStore.keys()));
    
    return response;
  } catch (error) {
    console.error('Error initiating Xero OAuth:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=auth_failed`);
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';
import { stateStore, cleanupStates } from '@/lib/oauth-state';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  try {
    // Clean up old states
    cleanupStates();
    
    // Generate a cryptographically secure random state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in memory
    stateStore.set(state, { timestamp: Date.now() });
    
    // Get the authorization URL
    const authUrl = await getAuthUrl(state);
    
    // Also try to store state in cookie as backup
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('xero_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    console.log('OAuth initiated with state:', state);
    console.log('States in memory:', Array.from(stateStore.keys()));
    
    return response;
  } catch (error: any) {
    console.error('Error initiating Xero OAuth:', error);
    console.error('Auth error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    // Return a more detailed error response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    const errorMessage = encodeURIComponent(error.message || 'auth_initialization_failed');
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=${errorMessage}&details=${encodeURIComponent(error.stack || 'No stack trace')}`);
  }
}
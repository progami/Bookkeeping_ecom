import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';
import { stateStore, cleanupStates } from '@/lib/oauth-state';
import crypto from 'crypto';
import { structuredLogger } from '@/lib/logger';

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
    
    structuredLogger.info('OAuth initiated', {
      component: 'xero-auth',
      stateLength: state.length,
      statesInMemory: stateStore.size
    });
    
    return response;
  } catch (error: any) {
    structuredLogger.error('Error initiating Xero OAuth', error, {
      component: 'xero-auth',
      errorCode: error.code,
      errorName: error.name
    });
    
    // Return a more detailed error response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    const errorMessage = encodeURIComponent(error.message || 'auth_initialization_failed');
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=${errorMessage}&details=${encodeURIComponent(error.stack || 'No stack trace')}`);
  }
}
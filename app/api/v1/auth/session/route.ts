import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';
import { SESSION_COOKIE_NAME } from '@/lib/cookie-config';

export async function GET(request: NextRequest) {
  try {
    // Check for user session cookie
    const userSessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    
    if (!userSessionCookie) {
      structuredLogger.debug('No user session found', {
        component: 'auth-session'
      });
      
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }
    
    try {
      // Parse the user session
      const userSession = JSON.parse(userSessionCookie.value);
      
      structuredLogger.debug('User session found', {
        component: 'auth-session',
        userId: userSession.userId,
        email: userSession.email
      });
      
      // Return authenticated status with user info
      return NextResponse.json({
        authenticated: true,
        user: {
          userId: userSession.userId,
          email: userSession.email,
          tenantId: userSession.tenantId,
          tenantName: userSession.tenantName
        }
      });
    } catch (parseError) {
      structuredLogger.error('Failed to parse user session', parseError, {
        component: 'auth-session'
      });
      
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }
  } catch (error) {
    structuredLogger.error('Error checking session', error, {
      component: 'auth-session'
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
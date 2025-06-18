import { NextRequest, NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';
import { validateSession, ValidationLevel } from '@/lib/auth/session-validation';

export async function GET(request: NextRequest) {
  try {
    // Check for actual user session (not anonymous)
    const session = await validateSession(request, ValidationLevel.USER);
    
    if (!session.isValid || !session.user || session.user.userId === 'anonymous') {
      structuredLogger.debug('No valid session found', {
        component: 'auth-session'
      });
      
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }
    
    structuredLogger.debug('Valid session found', {
      component: 'auth-session',
      userId: session.user.userId,
      email: session.user.email
    });
    
    // Return authenticated status with user info
    return NextResponse.json({
      authenticated: true,
      user: {
        userId: session.user.userId,
        email: session.user.email,
        tenantId: session.user.tenantId,
        tenantName: session.user.tenantName,
        role: session.user.role,
        isAdmin: session.isAdmin
      }
    });
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
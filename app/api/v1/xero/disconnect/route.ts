import { NextRequest, NextResponse } from 'next/server';
import { clearTokenSet } from '@/lib/xero-client';
import { XeroSession } from '@/lib/xero-session';
import { withRateLimit } from '@/lib/rate-limiter';
import { Logger } from '@/lib/logger';

const logger = new Logger({ component: 'xero-disconnect' });

export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    // Clear token from storage
    await clearTokenSet();
    
    // Create response
    const response = NextResponse.json({ success: true });
    
    // Properly delete the cookie
    response.cookies.delete('xero_token');
    
    // Also try the explicit delete with options
    response.cookies.set('xero_token', '', {
      maxAge: -1,
      path: '/',
      expires: new Date(0)
    });
    
    logger.info('Xero token cookie deleted successfully');
    
    return response;
  } catch (error) {
    logger.error('Error disconnecting Xero', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
});
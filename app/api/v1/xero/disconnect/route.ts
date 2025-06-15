import { NextRequest, NextResponse } from 'next/server';
import { clearTokenSet } from '@/lib/xero-client';
import { XeroSession } from '@/lib/xero-session';

export async function POST(request: NextRequest) {
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
    
    console.log('[Disconnect] Token cookie deleted');
    
    return response;
  } catch (error) {
    console.error('Error disconnecting Xero:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Clear any existing tokens
    const cookieStore = await cookies();
    cookieStore.delete('xero_token');
    cookieStore.delete('xero_state');
    
    // Return the auth URL for reconnection
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    const authUrl = `${baseUrl}/api/v1/xero/auth`;
    
    return NextResponse.json({
      success: true,
      message: 'Cleared existing tokens. Please reconnect.',
      authUrl
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to clear tokens',
      message: error.message
    }, { status: 500 });
  }
}
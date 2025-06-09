import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    // Generate a random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Get the authorization URL
    const authUrl = await getAuthUrl(state);
    
    // Store state in cookie for verification later
    const response = NextResponse.redirect(authUrl);
    response.cookies.set('xero_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/'
    });
    
    return response;
  } catch (error) {
    console.error('Error initiating Xero OAuth:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003';
    return NextResponse.redirect(`${baseUrl}/bookkeeping?error=auth_failed`);
  }
}
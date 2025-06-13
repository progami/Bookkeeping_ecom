import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// Mock authentication for development/testing when SSL is not available
export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    // Create a mock token that matches the structure expected by the app
    const mockTokenSet = {
      access_token: 'mock-access-token-for-development',
      refresh_token: 'mock-refresh-token-for-development',
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'accounting.transactions accounting.settings accounting.reports.read offline_access'
    };

    // Mock tenant ID (you can replace with actual tenant ID if known)
    const mockTenantId = '!WLmfK-X0h3sTcN3pp_zAA'; // Example Xero tenant ID format

    // Set cookies to simulate successful authentication
    const cookieStore = cookies();
    
    // Store token
    cookieStore.set('xero_token_set', JSON.stringify(mockTokenSet), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    // Store tenant ID
    cookieStore.set('xero_tenant_id', mockTenantId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    console.log('Mock authentication successful');
    console.log('Mock token set:', mockTokenSet);
    console.log('Mock tenant ID:', mockTenantId);

    // Redirect back to bookkeeping with success
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3003';
    return NextResponse.redirect(`${baseUrl}/bookkeeping?auth=mock&success=true`);

  } catch (error: any) {
    console.error('Error in mock auth:', error);
    return NextResponse.json({ 
      error: 'Failed to set mock authentication',
      message: error.message 
    }, { status: 500 });
  }
}

// Helper endpoint to check mock auth status
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('xero_token_set');
    const tenantCookie = cookieStore.get('xero_tenant_id');

    return NextResponse.json({
      hasToken: !!tokenCookie,
      hasTenant: !!tenantCookie,
      tokenValue: tokenCookie?.value ? 'Set' : 'Not set',
      tenantValue: tenantCookie?.value || 'Not set'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
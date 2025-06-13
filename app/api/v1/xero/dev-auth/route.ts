import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// This is a development-only endpoint for testing without SSL
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    // Create a mock token for development
    const mockToken = {
      access_token: 'dev-access-token',
      refresh_token: 'dev-refresh-token',
      expires_in: 1800,
      token_type: 'Bearer',
      scope: 'openid profile email accounting.transactions accounting.settings accounting.reports.read offline_access',
      id_token: 'dev-id-token'
    };

    // Create a mock tenant ID
    const mockTenantId = 'dev-tenant-id';

    // Set development cookies
    const cookieStore = cookies();
    
    cookieStore.set('xero_token_set', JSON.stringify(mockToken), {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    cookieStore.set('xero_tenant_id', mockTenantId, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/'
    });

    console.log('Development authentication set');
    
    // Redirect to bookkeeping page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/bookkeeping?auth=dev`);

  } catch (error: any) {
    console.error('Error in dev auth:', error);
    return NextResponse.json({ error: 'Failed to set dev auth' }, { status: 500 });
  }
}
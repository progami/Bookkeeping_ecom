import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Development bypass for SSL issues - creates valid Xero session
export async function GET(request: NextRequest) {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
    }

    // Create a real-looking token that matches Xero's format
    const mockTokenSet = {
      access_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkiLCJ0eXAiOiJKV1QiLCJ4NXQiOiJISy1PWm5jdGJjQW8xbkp2MENZVmdWY08_QmsifQ.eyJuYmYiOjE3MzY1MjY4NDAsImV4cCI6MTczNjUyODY0MCwiaXNzIjoiaHR0cHM6Ly9pZGVudGl0eS54ZXJvLmNvbSIsImF1ZCI6Imh0dHBzOi8vaWRlbnRpdHkueGVyby5jb20vcmVzb3VyY2VzIiwiY2xpZW50X2lkIjoiNzgxMTg0RDFBRDMxNENCNjk4OUVCOEQyMjkxQUI0NTMiLCJ4ZXJvX3VzZXJpZCI6ImJjYTk3ZGE0LTY0YzQtNGJjMy05ZGE1LWY5OGY0ZTk1NjBhOCIsImdsb2JhbF9zZXNzaW9uX2lkIjoiMmZjYzU0YTMzYzI0NGI4OGI4ZjE0ZGQ1MWQ2ZGM5ZjAiLCJqdGkiOiJGOTdFMjBGODNBMzNFQjQ3RjEyNjFERTY4QkQ2MEUyRiIsImF1dGhlbnRpY2F0aW9uX2V2ZW50X2lkIjoiODcyZjNjNjctNGY3ZC00YTgzLWE5ZTktOGFjYjg0MjBjMjdiIiwic2NvcGUiOlsiYWNjb3VudGluZy50cmFuc2FjdGlvbnMiLCJhY2NvdW50aW5nLnNldHRpbmdzIiwiYWNjb3VudGluZy5yZXBvcnRzLnJlYWQiLCJvZmZsaW5lX2FjY2VzcyJdLCJpYXQiOjE3MzY1MjY4NDAsImF1dGhfdGltZSI6MTczNjUyNjgzOX0.dev-signature',
      refresh_token: 'dev-refresh-token-f4e9b835c7f5487fb90f9e8a4b20c27b',
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
      expires_in: 1800,
      token_type: 'Bearer',
      scope: 'accounting.transactions accounting.settings accounting.reports.read offline_access',
      id_token: 'dev-id-token'
    };

    // Real Xero tenant ID format
    const tenantId = '!WLmfK-X0h3sTcN3pp_zAA';

    // Set cookies
    const cookieStore = cookies();
    
    cookieStore.set('xero_token_set', JSON.stringify(mockTokenSet), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    });

    cookieStore.set('xero_tenant_id', tenantId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/'
    });

    console.log('Bypass authentication successful');
    
    // Redirect to bookkeeping
    return NextResponse.redirect('https://localhost:3003/bookkeeping?auth=bypass');

  } catch (error: any) {
    console.error('Error in bypass auth:', error);
    return NextResponse.json({ error: 'Failed to bypass auth' }, { status: 500 });
  }
}
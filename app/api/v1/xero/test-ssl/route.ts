import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3003';
  
  return NextResponse.json({
    ssl_status: {
      protocol,
      host,
      url: request.url,
      is_https: protocol === 'https' || request.url.startsWith('https'),
      headers: {
        'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
        'x-forwarded-host': request.headers.get('x-forwarded-host'),
        'host': request.headers.get('host')
      }
    },
    env: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      XERO_REDIRECT_URI: process.env.XERO_REDIRECT_URI,
      NODE_ENV: process.env.NODE_ENV
    },
    solution: {
      issue: 'Xero OAuth requires HTTPS for redirect URIs',
      current_redirect_uri: process.env.XERO_REDIRECT_URI,
      options: [
        '1. Install ngrok: brew install ngrok/ngrok/ngrok',
        '2. Run: ngrok http 3003',
        '3. Update .env with ngrok URL',
        '4. Add ngrok URL to Xero app settings'
      ]
    }
  });
}
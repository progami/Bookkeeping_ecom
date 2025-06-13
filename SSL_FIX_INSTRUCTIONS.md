# SSL Issue Fix for Xero OAuth

The Xero OAuth flow requires HTTPS for the redirect URI, but local development typically uses HTTP. Here are three solutions:

## Solution 1: Use ngrok (Recommended)

1. Install ngrok: `brew install ngrok/ngrok/ngrok`
2. Run: `./setup-ngrok.sh`
3. Copy the ngrok URL (e.g., https://abc123.ngrok.io)
4. Update .env:
   ```
   NEXT_PUBLIC_APP_URL="https://abc123.ngrok.io"
   XERO_REDIRECT_URI="https://abc123.ngrok.io/api/v1/xero/auth/callback"
   ```
5. Add the redirect URI to your Xero app settings
6. Access the app via the ngrok URL

## Solution 2: Use mkcert for local HTTPS

1. Run: `./setup-https.sh`
2. This installs mkcert and generates trusted certificates
3. Keep .env with HTTPS URLs:
   ```
   NEXT_PUBLIC_APP_URL="https://localhost:3003"
   XERO_REDIRECT_URI="https://localhost:3003/api/v1/xero/auth/callback"
   ```
4. Access via: https://localhost:3003

## Solution 3: Development Bypass (Testing Only)

For immediate testing without fixing SSL:

1. Visit: https://localhost:3003/api/v1/xero/bypass-auth
2. Accept the certificate warning
3. This creates mock authentication cookies
4. You'll be redirected to the bookkeeping page

## Current Status

- HTTPS server is running on port 3003
- Self-signed certificate is being used
- Xero requires the redirect URI to match exactly (including protocol)
- The Xero app is configured for HTTPS callbacks

## Next Steps

1. Choose one of the solutions above
2. For production, use proper SSL certificates
3. Test credentials: ajarrar@trademanenterprise.com / gW2r4*8&wFM.#fZ
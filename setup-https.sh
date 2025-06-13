#!/bin/bash

# Setup script for local HTTPS development with mkcert

echo "Setting up local HTTPS for Xero OAuth..."

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo "mkcert not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install mkcert
    else
        echo "Please install mkcert manually: https://github.com/FiloSottile/mkcert#installation"
        exit 1
    fi
fi

# Install the local CA
echo "Installing local CA..."
mkcert -install

# Generate certificates for localhost
echo "Generating certificates for localhost..."
mkcert -cert-file localhost.crt -key-file localhost.key localhost 127.0.0.1 ::1

echo "Certificates generated successfully!"
echo ""
echo "Next steps:"
echo "1. Make sure your .env file uses HTTPS URLs:"
echo "   NEXT_PUBLIC_APP_URL=\"https://localhost:3003\""
echo "   XERO_REDIRECT_URI=\"https://localhost:3003/api/v1/xero/auth/callback\""
echo ""
echo "2. Add the redirect URI to your Xero app settings"
echo ""
echo "3. Run the HTTPS server:"
echo "   npm run dev:https"
echo ""
echo "Your browser will now trust the local certificates!"
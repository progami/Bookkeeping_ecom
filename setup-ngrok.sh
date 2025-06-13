#!/bin/bash

# Setup script for ngrok tunnel to bypass SSL issues

echo "Setting up ngrok tunnel for Xero OAuth..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok not found. Please install it first:"
    echo ""
    echo "macOS: brew install ngrok/ngrok/ngrok"
    echo "Or download from: https://ngrok.com/download"
    exit 1
fi

# Check if server is running
if ! curl -s http://localhost:3003 > /dev/null 2>&1; then
    echo "Server not running on port 3003. Please start the server first:"
    echo "npm run dev"
    exit 1
fi

echo ""
echo "Starting ngrok tunnel..."
echo "Once ngrok starts, you'll see a URL like: https://abc123.ngrok.io"
echo ""
echo "Then update your .env file with:"
echo "NEXT_PUBLIC_APP_URL=\"https://abc123.ngrok.io\""
echo "XERO_REDIRECT_URI=\"https://abc123.ngrok.io/api/v1/xero/auth/callback\""
echo ""
echo "Also add this redirect URI to your Xero app settings."
echo ""

# Start ngrok
ngrok http 3003
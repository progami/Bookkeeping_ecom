#!/bin/bash
# Script to start Chrome with remote debugging enabled

# Close existing Chrome instances
echo "Closing existing Chrome instances..."
pkill -f "Google Chrome"
sleep 2

# Start Chrome with remote debugging
echo "Starting Chrome with remote debugging on port 9222..."
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  https://localhost:3003/bookkeeping &

echo "Chrome started with remote debugging enabled!"
echo "You can now connect to it programmatically on port 9222"
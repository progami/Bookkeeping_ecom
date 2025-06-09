#!/bin/bash

# Kill any existing Next.js dev server on port 3003
lsof -ti:3003 | xargs kill -9 2>/dev/null

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the dev server and log output
echo "Starting Next.js dev server with logging..."
echo "Log file: logs/dev-server.log"
echo "Server will be available at: http://localhost:3003"
echo ""
echo "Press Ctrl+C to stop the server"

# Run npm dev and pipe output to both console and log file
npm run dev 2>&1 | tee logs/dev-server.log
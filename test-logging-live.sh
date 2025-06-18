#!/bin/bash

echo "=== Testing Live Server Logging ==="
echo ""

# Test 1: Check server is running
echo "1. Testing server health..."
curl -k https://localhost:3003/api/v1/auth/status 2>/dev/null
echo ""

# Test 2: Login
echo -e "\n2. Testing login..."
curl -k -X POST https://localhost:3003/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' 2>/dev/null
echo ""

# Wait for logs to flush
echo -e "\n3. Waiting for logs to flush..."
sleep 2

# Check logs
echo -e "\n=== LOG FILE CHECK ==="
if [ -f logs/development.log ]; then
    lines=$(wc -l < logs/development.log)
    echo "Log file has $lines lines"
    echo ""
    echo "Last 10 logs:"
    tail -10 logs/development.log
else
    echo "❌ No log file found!"
fi

echo -e "\n✓ Test complete!"
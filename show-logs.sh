#!/bin/bash
# Simple script to show the latest log file

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Find the latest log file
LATEST_LOG=$(ls -t logs/app-*.log 2>/dev/null | head -1)

if [ -z "$LATEST_LOG" ]; then
    echo -e "${RED}No log files found in logs/ directory${NC}"
    echo "Start the server first with: npm run dev"
    exit 1
fi

echo -e "${GREEN}Latest log file: ${YELLOW}$LATEST_LOG${NC}"
echo -e "${GREEN}Press Ctrl+C to exit${NC}\n"

# Check if we should tail or cat
if [ "$1" == "-f" ] || [ "$1" == "--follow" ]; then
    tail -f "$LATEST_LOG"
else
    cat "$LATEST_LOG"
    echo -e "\n${YELLOW}Tip: Use './show-logs.sh -f' to follow the log in real-time${NC}"
fi
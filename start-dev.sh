#!/bin/bash
# Development startup script with enhanced logging

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Bookkeeping App with Enhanced Logging...${NC}"

# Ensure logs directory exists
mkdir -p logs

# Clean up old session logs (keep last 10)
echo -e "${YELLOW}Cleaning up old session logs...${NC}"
ls -t logs/app-*.log 2>/dev/null | tail -n +11 | xargs -r rm

# Show current log files
echo -e "\n${GREEN}Current log files:${NC}"
ls -la logs/ 2>/dev/null || echo "No logs yet"

# Start the development server
echo -e "\n${GREEN}Starting development server...${NC}"
echo -e "${YELLOW}Logs will be written to: logs/app-$(date +%Y-%m-%d-%H-%M-%S).log${NC}"
echo -e "${YELLOW}View logs with: npm run logs${NC}"
echo -e "${YELLOW}Tail logs with: npm run logs:tail${NC}\n"

# Start the server
npm run dev
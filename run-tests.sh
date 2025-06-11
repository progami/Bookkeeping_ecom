#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Playwright Tests for Finance Module${NC}"
echo "================================================"

# Check if server is running
if ! curl -s http://localhost:3003 > /dev/null; then
    echo -e "${RED}Error: Development server is not running on port 3003${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo -e "${GREEN}✓ Development server is running${NC}"

# Install Playwright browsers if needed
if [ ! -d "node_modules/@playwright/test/node_modules/.cache" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Run tests
echo -e "\n${YELLOW}Running E2E Tests...${NC}"
echo "--------------------"

# Run all tests
echo -e "\n${YELLOW}1. Finance Dashboard Tests${NC}"
npx playwright test tests/e2e/finance-dashboard.spec.ts --reporter=list

echo -e "\n${YELLOW}2. Bookkeeping Dashboard Tests${NC}"
npx playwright test tests/e2e/bookkeeping-dashboard.spec.ts --reporter=list

echo -e "\n${YELLOW}3. SOP Generator Tests${NC}"
npx playwright test tests/e2e/sop-generator.spec.ts --reporter=list

echo -e "\n${YELLOW}4. Xero OAuth Tests${NC}"
npx playwright test tests/e2e/xero-oauth.spec.ts --reporter=list

# Generate HTML report
echo -e "\n${YELLOW}Generating HTML Report...${NC}"
npx playwright show-report

echo -e "\n${GREEN}✓ All tests completed!${NC}"
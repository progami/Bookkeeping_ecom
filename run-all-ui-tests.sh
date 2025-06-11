#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   COMPLETE UI ELEMENT TESTING SUITE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if server is running
if ! curl -s http://localhost:3003 > /dev/null; then
    echo -e "${RED}Error: Development server is not running on port 3003${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo -e "${GREEN}✓ Development server is running${NC}"
echo ""

# Install Playwright browsers if needed
if [ ! -d "node_modules/@playwright/test/node_modules/.cache" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Array of test files
test_files=(
    "tests/e2e/finance-dashboard-complete.spec.ts"
    "tests/e2e/bookkeeping-dashboard-complete.spec.ts"
    "tests/e2e/transactions-complete.spec.ts"
    "tests/e2e/sop-generator-complete.spec.ts"
    "tests/e2e/sop-tables-complete.spec.ts"
    "tests/e2e/rules-management-complete.spec.ts"
)

# Run tests with detailed reporting
echo -e "${YELLOW}Running Complete UI Test Suite...${NC}"
echo "------------------------------------"

# Initialize counters
total_tests=0
passed_tests=0
failed_tests=0

# Run each test file
for test_file in "${test_files[@]}"; do
    echo ""
    echo -e "${BLUE}Running: $test_file${NC}"
    echo "------------------------------------"
    
    # Run test and capture output
    if npx playwright test "$test_file" --reporter=list; then
        echo -e "${GREEN}✓ $test_file passed${NC}"
        ((passed_tests++))
    else
        echo -e "${RED}✗ $test_file failed${NC}"
        ((failed_tests++))
    fi
    
    ((total_tests++))
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total test files: ${total_tests}"
echo -e "${GREEN}Passed: ${passed_tests}${NC}"
echo -e "${RED}Failed: ${failed_tests}${NC}"

# Generate HTML report
echo ""
echo -e "${YELLOW}Generating HTML Report...${NC}"
npx playwright show-report

if [ $failed_tests -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}    ALL UI TESTS PASSED! 🎉${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}    SOME TESTS FAILED ❌${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
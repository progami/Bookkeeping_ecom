#!/bin/bash

echo "=== Comprehensive Application Test ==="
echo "Testing all modules and navigating in your Chrome browser"
echo ""

# Base URL
BASE_URL="https://localhost:3003"

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    echo -n "Testing $name... "
    response=$(curl -k -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$response" = "200" ]; then
        echo "✅ OK ($response)"
    else
        echo "❌ Failed ($response)"
    fi
}

# Function to navigate Chrome
navigate_chrome() {
    local url=$1
    osascript -e "tell application \"Google Chrome\" to set URL of active tab of window 1 to \"$url\""
    sleep 2
}

echo "1. Testing API Endpoints:"
echo "-------------------------"
test_endpoint "Xero Status" "$BASE_URL/api/v1/xero/status"
test_endpoint "Balance Sheet" "$BASE_URL/api/v1/xero/reports/balance-sheet"
test_endpoint "Profit & Loss" "$BASE_URL/api/v1/xero/reports/profit-loss"
test_endpoint "Chart of Accounts" "$BASE_URL/api/v1/xero/sync-gl-accounts"
test_endpoint "Transactions" "$BASE_URL/api/v1/xero/transactions"
test_endpoint "Cash Balance" "$BASE_URL/api/v1/bookkeeping/cash-balance"
test_endpoint "Analytics" "$BASE_URL/api/v1/bookkeeping/analytics"

echo ""
echo "2. Checking Xero Connection:"
echo "----------------------------"
xero_status=$(curl -k -s "$BASE_URL/api/v1/xero/status" | grep -o '"connected":[^,}]*' | cut -d: -f2)
if [ "$xero_status" = "true" ]; then
    echo "✅ Xero is connected!"
else
    echo "❌ Xero is not connected"
fi

echo ""
echo "3. Navigating through pages in Chrome:"
echo "-------------------------------------"

echo "Opening Finance Dashboard..."
navigate_chrome "$BASE_URL/finance"

echo "Opening Bookkeeping Module..."
navigate_chrome "$BASE_URL/bookkeeping"

echo "Opening Chart of Accounts..."
navigate_chrome "$BASE_URL/bookkeeping/chart-of-accounts"

echo "Opening Transactions..."
navigate_chrome "$BASE_URL/bookkeeping/transactions"

echo "Opening Analytics..."
navigate_chrome "$BASE_URL/bookkeeping/analytics"

echo "Opening Cash Flow..."
navigate_chrome "$BASE_URL/cashflow"

echo "Back to Finance Dashboard..."
navigate_chrome "$BASE_URL/finance"

echo ""
echo "4. Fetching sample data:"
echo "------------------------"

# Get chart of accounts count
accounts=$(curl -k -s "$BASE_URL/api/v1/xero/sync-gl-accounts" | grep -o '"accounts":\[[^]]*\]' | grep -o '{' | wc -l)
echo "Chart of Accounts: $accounts accounts found"

# Get cash balance
balance=$(curl -k -s "$BASE_URL/api/v1/bookkeeping/cash-balance" | grep -o '"balance":[^,}]*' | cut -d: -f2)
echo "Cash Balance: £$balance"

echo ""
echo "=== Test Complete ==="
echo "Check your Chrome browser - it should have navigated through all the modules."
echo ""
echo "If Xero is not connected:"
echo "1. Click 'Connect Xero' button in the Bookkeeping page"
echo "2. Complete the authentication (you already did 2FA)"
echo "3. The app should then show all your financial data"
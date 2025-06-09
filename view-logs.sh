#!/bin/bash

# Simple log viewer script

case "$1" in
  "live")
    echo "Showing live logs (Ctrl+C to exit)..."
    tail -f logs/dev-server.log
    ;;
  "errors")
    echo "Showing errors and warnings..."
    grep -E "(error|Error|ERROR|warning|Warning|WARNING|failed|Failed|FAILED)" logs/dev-server.log
    ;;
  "oauth")
    echo "Showing OAuth-related logs..."
    grep -E "(OAuth|oauth|state|State|callback|token|Token|Xero|xero)" logs/dev-server.log
    ;;
  "recent")
    echo "Showing last 50 lines..."
    tail -50 logs/dev-server.log
    ;;
  "clear")
    echo "Clearing log file..."
    > logs/dev-server.log
    echo "Log file cleared."
    ;;
  *)
    echo "Usage: ./view-logs.sh [command]"
    echo ""
    echo "Commands:"
    echo "  live    - Show live log output"
    echo "  errors  - Show errors and warnings"
    echo "  oauth   - Show OAuth-related logs"
    echo "  recent  - Show last 50 lines"
    echo "  clear   - Clear the log file"
    echo ""
    echo "Example: ./view-logs.sh live"
    ;;
esac
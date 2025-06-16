# 🚀 Quick Start: Enhanced Logging System

## Starting the Server with Logging

```bash
# Use the new startup script
./start-dev.sh

# Or manually
npm run dev
```

## Viewing Logs

### Real-time Monitoring
```bash
# Tail the latest log (updates live)
npm run logs:tail

# View only errors as they happen
npm run logs:errors -- --tail
```

### Searching Logs
```bash
# View latest log
npm run logs

# Search for specific terms
npm run logs -- --search "cashflow"
npm run logs -- --search "error" --level error

# View last 100 entries
npm run logs -- --last 100
```

### List All Logs
```bash
# See all available log files
npm run logs:list
```

## Log Files Location

All logs are stored in the `logs/` directory:

- **Session Logs**: `app-YYYY-MM-DD-HH-MM-SS.log` - Complete logs for each server session
- **Combined Logs**: `combined-YYYY-MM-DD.log` - All logs for a specific day
- **Error Logs**: `error-YYYY-MM-DD.log` - Only errors and warnings
- **HTTP Logs**: `http-YYYY-MM-DD.log` - Request/response logs

## What Gets Logged

1. **Every API Request**: URL, method, headers, body, response, timing
2. **All Console Output**: console.log, console.error, console.warn
3. **Errors**: Full stack traces with context
4. **Database Queries**: When using structured logger
5. **Authentication**: Login attempts, token refreshes
6. **Xero API Calls**: All interactions with Xero

## Debugging Workflow

1. **Start the server**: `./start-dev.sh`
2. **Reproduce the issue** in the app
3. **Check logs**: `npm run logs -- --search "error"`
4. **Get full context**: Each log entry has a request ID for tracing

## Example: Debugging Cashflow Issue

```bash
# Start server
./start-dev.sh

# In another terminal, watch for cashflow errors
npm run logs -- --search "cashflow" --tail

# Click on cashflow in the app
# Logs will show exactly what's happening
```

## Tips

- 🔍 Each request has a unique ID (e.g., `[req-abc123]`) for tracing
- 📝 Logs are JSON formatted for easy parsing
- 🚨 Errors include full stack traces
- 🔐 Sensitive data (tokens, passwords) are automatically sanitized
- 📊 Request timing helps identify performance issues

## Current Issues Being Logged

Based on your logs, these issues are being tracked:
1. **Cashflow validation errors** - Missing or invalid query parameters
2. **Xero client initialization failures** - Token or connection issues
3. **Live report endpoints returning 401** - Authentication problems

The enhanced logging will capture complete details for debugging these issues!
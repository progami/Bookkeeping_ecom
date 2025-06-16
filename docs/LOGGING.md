# Comprehensive Logging System

## Overview

The bookkeeping app now includes a comprehensive logging system that captures all console output, API requests/responses, and application events with structured logging, request tracking, and automatic file rotation.

## Features

- **Centralized Log File Management**: New timestamped log file created on each server start
- **Structured Logging**: JSON format with timestamps, levels, and context
- **Request ID Tracking**: Unique ID assigned to each request for tracing
- **Console Output Capture**: All console.log/error/warn/info captured to files
- **Log Rotation**: Automatic daily rotation with size limits
- **Multiple Log Files**: Separate files for errors, HTTP requests, and combined logs
- **Log Viewer Tool**: Command-line tool for viewing and searching logs

## Log Files

All logs are stored in the `logs/` directory:

- `app-YYYY-MM-DD-HH-mm-ss.log` - Session log file (created on startup)
- `combined-YYYY-MM-DD.log` - All logs for the day (rotating)
- `error-YYYY-MM-DD.log` - Error logs only (rotating)
- `http-YYYY-MM-DD.log` - HTTP request/response logs (rotating)
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

## Usage

### In Server Code

The server automatically captures all console output and logs requests:

```javascript
// All console output is automatically logged
console.log('This will be logged to file');
console.error('This error will be logged');

// Request logging happens automatically
// Each request gets a unique ID for tracking
```

### In API Routes

Use the enhanced logger in API routes:

```javascript
import { getApiLogger, logApiCall } from '@/lib/api-logger';

export async function GET(request) {
  const logger = getApiLogger(request);
  
  try {
    logger.info('Processing request', { customData: 'value' });
    
    // Log API calls with timing
    const result = await logApiCall(
      logger,
      'fetch data from database',
      () => prisma.data.findMany()
    );
    
    // Log external API calls
    logExternalApi(logger, 'Xero', 'GET', '/api/invoices', {
      response: result,
      duration: 150
    });
    
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Request failed', error);
    throw error;
  }
}
```

### Log Levels

- `error` - Error messages and stack traces
- `warn` - Warning messages
- `info` - General information
- `http` - HTTP request/response logs
- `debug` - Debug information (verbose)

## Log Viewer Tool

### View Logs

```bash
# View latest session log
npm run logs

# View last 50 entries
npm run logs -- view --last 50

# View only errors
npm run logs:errors

# View specific log file
npm run logs -- view combined-2024-01-15.log

# Search logs
npm run logs -- view --search "GET /api" --last 100

# View with full stack traces
npm run logs -- view --level error --stack
```

### Tail Logs

```bash
# Tail latest log in real-time
npm run logs:tail

# Tail specific log file
npm run logs -- tail --file error-2024-01-15.log
```

### List All Logs

```bash
# List all log files with sizes and dates
npm run logs:list
```

## Configuration

### Environment Variables

- `LOG_LEVEL` - Set logging level (default: 'debug' in dev, 'info' in prod)

### Log Retention

- Session logs: No automatic deletion
- Combined logs: 7 days
- Error logs: 30 days
- HTTP logs: 3 days

### File Size Limits

- Error logs: 20MB per file
- Combined logs: 50MB per file
- HTTP logs: 50MB per file

## Log Format

Logs are stored in JSON format with the following structure:

```json
{
  "timestamp": "2024-01-15 10:30:45.123",
  "level": "info",
  "message": "Processing cashflow forecast",
  "requestId": "abc-123-def",
  "method": "GET",
  "path": "/api/v1/cashflow/forecast",
  "duration": 145,
  "metadata": {
    "days": 90,
    "includeScenarios": true
  }
}
```

## Best Practices

1. **Use Structured Logging**: Pass objects with metadata instead of concatenating strings
2. **Include Context**: Always include relevant context (IDs, counts, durations)
3. **Log Errors with Stack Traces**: Use `logger.error('message', error)`
4. **Use Request IDs**: The request ID is automatically included for tracing
5. **Log API Calls**: Log external API calls with request/response data
6. **Avoid Sensitive Data**: The logger automatically sanitizes common sensitive fields

## Troubleshooting

### Missing Logs

1. Check the `logs/` directory exists
2. Verify write permissions
3. Check disk space
4. Look for errors in `exceptions.log`

### Performance Impact

The logging system is designed for minimal performance impact:
- Asynchronous file writes
- Efficient JSON serialization
- Automatic log rotation to prevent large files
- Console output is still displayed in development

### Log File Cleanup

Old log files are automatically cleaned up based on retention policies. To manually clean:

```bash
# Remove logs older than 7 days
find logs/ -name "*.log" -mtime +7 -delete

# Keep only latest session logs
ls -t logs/app-*.log | tail -n +6 | xargs rm -f
```

## Integration with Monitoring

The structured JSON format makes it easy to integrate with log aggregation services:
- Datadog
- Splunk
- ELK Stack
- CloudWatch Logs
- Google Cloud Logging

Export logs using the standard format and ship to your preferred service.
# Logging Standards and Best Practices

This document outlines the standardized logging principles and practices to be followed across all projects. These standards ensure consistency, security, and maintainability of logging implementations.

## Core Principles

### 1. Structured Logging
- Use structured logging with consistent formats across all environments
- Include timestamps, module names, log levels, and contextual information
- Support JSON format for production environments to enable easy parsing

### 2. Log Levels
Implement a hierarchical logging system with the following levels:
- **ERROR** (0): Critical errors requiring immediate attention
- **WARN** (1): Warning conditions that should be investigated
- **INFO** (2): Informational messages about normal operations
- **HTTP** (3): HTTP request/response logging
- **DEBUG** (4): Detailed debugging information

### 3. Security and Sensitive Data Protection
- **NEVER** log sensitive information including:
  - Access tokens, refresh tokens, API keys
  - Passwords, secrets, authentication credentials
  - OAuth tokens and authorization codes
  - Cookie values and session identifiers
  - Personal identifiable information (PII)
- Implement automatic sanitization of sensitive patterns
- Use field-based redaction for known sensitive fields

### 4. Environment-Specific Configuration

#### Development Environment
- Console output with color-coded log levels
- Single log file (`logs/development.log`) that persists across sessions
- Full debug logging enabled by default
- Clear module identification in log messages

#### Production Environment
- File-based logging with log rotation
- Separate files for errors and combined logs
- JSON format for structured parsing
- Exception and rejection handlers
- Configurable log levels via environment variables

### 5. Module Identification
- Each log entry must identify its source module
- Use consistent module naming conventions: `[ModuleName]`
- Support nested module identification: `[CLIENT] [SubModule]`
- Extract and display module names in formatted output

## Implementation Guidelines

### 1. Logger Initialization
```typescript
import { logger } from './lib/logger';

// Use module-specific prefixes
logger.info('[ModuleName] Operation started');
logger.error('[ModuleName] Error occurred', error);
```

### 2. Contextual Logging
```typescript
// Create child loggers with context
const contextLogger = logger.child({ requestId: '123', userId: 'abc' });
contextLogger.info('Processing request');
```

### 3. Error Logging
- Always include stack traces for errors
- Log the full error object, not just the message
- Include relevant context (user ID, request ID, operation)
```typescript
logger.error('[ModuleName] Operation failed', {
  error: error.stack || error,
  userId: context.userId,
  operation: 'updateUser'
});
```

### 4. Performance Logging
- Log slow operations (>500ms for APIs)
- Include duration and performance metrics
- Use appropriate log levels (HTTP for requests, INFO for operations)

### 5. Request Logging
- Skip static assets and health check endpoints
- Include method, URL, status code, and duration
- Use visual indicators for status: ✅ (success), ⚠️ (warning), ❌ (error)

## File Structure and Rotation

### Development
- Single file: `logs/development.log`
- Cleared on server restart
- Append mode during runtime
- Human-readable format with timestamps

### Production
- Error logs: `logs/error-YYYY-MM-DD.log` (30-day retention)
- Combined logs: `logs/combined-YYYY-MM-DD.log` (7-day retention)
- Exception logs: `logs/exceptions.log`
- Rejection logs: `logs/rejections.log`
- Automatic rotation based on date and size (20MB max)

## Log Format Examples

### Console Format (Development)
```
[2024-01-15 10:30:45] [UserService] [INFO] - User created successfully
[2024-01-15 10:30:46] [AuthService] [ERROR] - Authentication failed
[2024-01-15 10:30:47] [APIGateway] [HTTP] - ✅ POST /api/users → 201 (123ms)
```

### File Format (All Environments)
```
[2024-01-15 10:30:45] [UserService] [INFO] - User created successfully
[2024-01-15 10:30:46] [AuthService] [ERROR] - Authentication failed: Invalid credentials
[2024-01-15 10:30:47] [APIGateway] [HTTP] - POST /api/users → 201 (123ms)
```

## Best Practices

### 1. Be Descriptive but Concise
- Include enough context to understand the operation
- Avoid redundant information
- Use consistent message formats

### 2. Log at Appropriate Levels
- ERROR: System failures, unhandled exceptions
- WARN: Deprecations, retries, fallbacks
- INFO: Business operations, state changes
- DEBUG: Detailed flow, variable values

### 3. Batch Related Logs
- Group related operations under a single request/correlation ID
- Use child loggers to maintain context
- Include timing information for multi-step processes

### 4. Monitor and Alert
- Set up alerts for ERROR level logs
- Monitor log volume for anomalies
- Review and archive logs regularly

### 5. Performance Considerations
- Avoid logging in tight loops
- Use appropriate log levels to control volume
- Consider async logging for high-throughput scenarios

## Integration with Other Systems

### 1. Monitoring Systems
- Export logs in JSON format for easy parsing
- Include correlation IDs for distributed tracing
- Support log aggregation tools (ELK, Splunk, etc.)

### 2. Error Tracking
- Integrate with error tracking services
- Include context for error reproduction
- Support source maps for client-side errors

### 3. Audit Trail
- Separate audit logs from application logs
- Include user actions and system changes
- Ensure compliance with retention policies

## Testing and Validation

### 1. Log Output Testing
- Verify sensitive data is properly sanitized
- Test log rotation and file management
- Validate log levels work as expected

### 2. Performance Testing
- Measure logging overhead
- Test high-volume scenarios
- Verify async logging behavior

### 3. Security Testing
- Attempt to log sensitive data
- Verify sanitization rules work
- Test log injection prevention

## Migration Guide

When adopting these logging standards in existing projects:

1. **Audit Current Logging**
   - Review existing console.log statements
   - Identify sensitive data exposure
   - Document current log formats

2. **Implement Core Logger**
   - Copy the logger implementation
   - Add sanitization rules
   - Configure environment-specific transports

3. **Gradual Migration**
   - Replace console.log with logger calls
   - Add module prefixes to messages
   - Implement error handling

4. **Testing and Validation**
   - Verify logs appear correctly
   - Test in all environments
   - Monitor for issues

5. **Documentation**
   - Update project documentation
   - Add logging guidelines to README
   - Create troubleshooting guides

## Maintenance

### Regular Tasks
- Review and rotate log files
- Update sanitization patterns
- Monitor disk usage
- Review log levels and volume

### Updates and Improvements
- Keep dependencies updated
- Review new security patterns
- Optimize performance
- Add new features as needed

## Conclusion

Consistent logging is crucial for maintaining and debugging applications. By following these standards, teams can ensure their applications provide clear, secure, and useful logging information across all environments.
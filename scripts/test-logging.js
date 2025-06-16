#!/usr/bin/env node

// Test the enhanced logging system
const { structuredLogger, Logger } = require('../lib/logger-enhanced-compiled');

console.log('Testing enhanced logging system...\n');

// Test different log levels
structuredLogger.info('This is an info message');
structuredLogger.warn('This is a warning message');
structuredLogger.error('This is an error message', new Error('Test error'));
structuredLogger.debug('This is a debug message', { debugData: 'test' });
structuredLogger.http('This is an HTTP message', { method: 'GET', path: '/test' });

// Test logger with context
const contextLogger = new Logger({ requestId: 'test-123', userId: 'user-456' });
contextLogger.info('Message with context');

// Test child logger
const childLogger = contextLogger.child({ operation: 'test-operation' });
childLogger.info('Message from child logger');

// Test API logging
childLogger.api('GET', '/api/test', {
  params: { id: '123' },
  response: { success: true },
  duration: 150
});

// Test error with stack trace
try {
  throw new Error('This is a test error with stack trace');
} catch (error) {
  structuredLogger.error('Caught an error', error);
}

// Test console output capture
console.log('Regular console.log message');
console.error('Regular console.error message');
console.warn('Regular console.warn message');

console.log('\n✓ Logging test complete!');
console.log('Check the logs directory for output files.');
// Direct test of the logger
const { structuredLogger } = require('./lib/logger');

console.log('=== DIRECT LOGGER TEST ===\n');

// Test all log levels
structuredLogger.info('[DirectTest] Testing info level');
structuredLogger.debug('[DirectTest] Testing debug level');
structuredLogger.warn('[DirectTest] Testing warn level');
structuredLogger.error('[DirectTest] Testing error level');

console.log('\nLogs should appear above and in logs/development.log');

// Check the log file after a delay
setTimeout(() => {
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(__dirname, 'logs', 'development.log');
  
  if (fs.existsSync(logPath)) {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    console.log(`\nLog file has ${lines.length} lines`);
    if (lines.length > 0) {
      console.log('\nLast few logs:');
      lines.slice(-5).forEach(line => console.log(line));
    }
  } else {
    console.log('\nLog file not found!');
  }
}, 1000);
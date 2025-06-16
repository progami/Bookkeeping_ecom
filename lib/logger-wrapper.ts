/**
 * Wrapper to make enhanced logger compatible with existing logger
 * This allows gradual migration to the enhanced logging system
 */

// Import the enhanced logger (if available)
let enhancedLogger: any;
let Logger: any;
let structuredLogger: any;
let requestLogger: any;

try {
  const enhanced = require('./logger-enhanced');
  enhancedLogger = enhanced.winstonLogger;
  Logger = enhanced.Logger;
  structuredLogger = enhanced.structuredLogger;
  requestLogger = enhanced.requestLogger;
} catch (e) {
  // Fall back to original logger if enhanced not available
  const original = require('./logger');
  enhancedLogger = original.winstonLogger;
  Logger = original.Logger;
  structuredLogger = original.structuredLogger;
  requestLogger = original.requestLogger;
}

// Export everything
export { enhancedLogger as winstonLogger, Logger, structuredLogger, requestLogger };

// Default export for backward compatibility
export default structuredLogger;
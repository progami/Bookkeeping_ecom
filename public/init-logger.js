// Initialize client logger immediately to capture ALL logs
(function() {
  // Only run in browser
  if (typeof window === 'undefined') return;
  
  // Store original console methods IMMEDIATELY
  const originalConsole = {
    log: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console)
  };
  
  // Buffer to store logs until we can send them
  window.__logBuffer = window.__logBuffer || [];
  
  // Get stack trace to find caller info
  const getCallerInfo = () => {
    const stack = new Error().stack || '';
    const lines = stack.split('\n');
    // Find the first line that's not from init-logger or console
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes('init-logger') && !line.includes('console.') && 
          (line.includes('.js') || line.includes('.tsx') || line.includes('.ts'))) {
        // Extract filename and line number
        const match = line.match(/([^\/\s]+\.(tsx?|jsx?|js)):(\d+):(\d+)/);
        if (match) {
          return `${match[1]}:${match[3]}`;
        }
      }
    }
    return '';
  };
  
  // Helper to add to buffer
  const addToBuffer = (level, args) => {
    // Convert args to string message - EXACTLY as they appear in console
    const message = args.map(arg => {
      if (arg instanceof Error) {
        return arg.stack || arg.toString();
      } else if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    window.__logBuffer.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
  };
  
  // Override console methods IMMEDIATELY
  console.log = (...args) => {
    const caller = getCallerInfo();
    if (caller) {
      addToBuffer('log', [caller, ...args]);
    } else {
      addToBuffer('log', args);
    }
    originalConsole.log(...args);
  };
  
  console.error = (...args) => {
    const caller = getCallerInfo();
    if (caller) {
      addToBuffer('error', [caller, ...args]);
    } else {
      addToBuffer('error', args);
    }
    originalConsole.error(...args);
  };
  
  console.warn = (...args) => {
    const caller = getCallerInfo();
    if (caller) {
      addToBuffer('warn', [caller, ...args]);
    } else {
      addToBuffer('warn', args);
    }
    originalConsole.warn(...args);
  };
  
  console.info = (...args) => {
    const caller = getCallerInfo();
    if (caller) {
      addToBuffer('info', [caller, ...args]);
    } else {
      addToBuffer('info', args);
    }
    originalConsole.info(...args);
  };
  
  console.debug = (...args) => {
    const caller = getCallerInfo();
    if (caller) {
      addToBuffer('debug', [caller, ...args]);
    } else {
      addToBuffer('debug', args);
    }
    originalConsole.debug(...args);
  };
  
  // Also capture unhandled errors immediately
  window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error || event.message);
  });
  
  // Capture unhandled promise rejections immediately
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });
  
  originalConsole.log('[Browser Logger] Initialized early - capturing ALL logs');
})();
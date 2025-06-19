import { NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';

export async function POST(request: Request) {
  structuredLogger.info('[LOGS API] Received request');
  try {
    const { logs } = await request.json();
    structuredLogger.info(`[LOGS API] Processing ${logs.length} logs`);
    
    if (!Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid logs format' }, { status: 400 });
    }
    
    // Process each log entry
    logs.forEach((log: any) => {
      const { level, message, timestamp } = log;
      
      // Write the log EXACTLY as it appears in browser console
      // Just add [BROWSER] prefix to distinguish from server logs
      const browserLog = `[BROWSER] ${message}`;
      
      // Use the exact log level from browser
      switch (level) {
        case 'error':
          structuredLogger.error(browserLog);
          break;
        case 'warn':
          structuredLogger.warn(browserLog);
          break;
        case 'debug':
          structuredLogger.debug(browserLog);
          break;
        case 'log':
        case 'info':
        default:
          structuredLogger.info(browserLog);
          break;
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    structuredLogger.error('[LOGS API] Failed to process client logs:', error);
    return NextResponse.json({ error: 'Failed to process logs' }, { status: 500 });
  }
}
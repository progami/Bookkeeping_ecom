import { NextResponse } from 'next/server';
import { structuredLogger } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { logs } = await request.json();
    
    if (!Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid logs format' }, { status: 400 });
    }
    
    // Process each log entry
    logs.forEach((log: any) => {
      const { level, message, timestamp } = log;
      
      // Map browser log levels to winston levels
      const logLevel = level === 'log' ? 'info' : level;
      
      // Add [CLIENT] prefix to distinguish browser logs
      const prefixedMessage = `[CLIENT] ${message}`;
      
      // Log using winston based on level
      switch (logLevel) {
        case 'error':
          structuredLogger.error(prefixedMessage);
          break;
        case 'warn':
          structuredLogger.warn(prefixedMessage);
          break;
        case 'debug':
          structuredLogger.debug(prefixedMessage);
          break;
        case 'info':
        default:
          structuredLogger.info(prefixedMessage);
          break;
      }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process client logs:', error);
    return NextResponse.json({ error: 'Failed to process logs' }, { status: 500 });
  }
}
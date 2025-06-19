'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Terminal, Trash2, Download } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  id: number;
}

export function DevLogPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const logIdRef = useRef(0);
  
  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  useEffect(() => {
    // Override console methods to capture logs
    const originalMethods = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug
    };
    
    const captureLog = (level: string, args: any[]) => {
      // Call original method
      originalMethods[level as keyof typeof originalMethods](...args);
      
      // Capture for panel
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      
      setLogs(prev => [...prev, {
        id: ++logIdRef.current,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message
      }].slice(-500)); // Keep last 500 logs
    };
    
    // Override methods
    console.log = (...args) => captureLog('log', args);
    console.error = (...args) => captureLog('error', args);
    console.warn = (...args) => captureLog('warn', args);
    console.info = (...args) => captureLog('info', args);
    console.debug = (...args) => captureLog('debug', args);
    
    // Cleanup
    return () => {
      console.log = originalMethods.log;
      console.error = originalMethods.error;
      console.warn = originalMethods.warn;
      console.info = originalMethods.info;
      console.debug = originalMethods.debug;
    };
  }, []);
  
  const filteredLogs = logs.filter(log => 
    filter === 'all' || log.level === filter
  );
  
  const clearLogs = () => setLogs([]);
  
  const downloadLogs = () => {
    const content = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const levelColors = {
    log: 'text-gray-300',
    info: 'text-blue-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    debug: 'text-purple-400'
  };
  
  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Toggle Dev Logs"
      >
        <Terminal className="h-5 w-5" />
      </button>
      
      {/* Log Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-96 bg-gray-900 text-white rounded-lg shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold">Dev Logs</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadLogs}
                className="p-1 hover:bg-gray-800 rounded"
                title="Download logs"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={clearLogs}
                className="p-1 hover:bg-gray-800 rounded"
                title="Clear logs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-800 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex gap-1 p-2 border-b border-gray-700">
            {['all', 'log', 'info', 'warn', 'error', 'debug'].map(level => (
              <button
                key={level}
                onClick={() => setFilter(level)}
                className={`px-2 py-1 text-xs rounded ${
                  filter === level 
                    ? 'bg-gray-700 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {level}
                {level !== 'all' && (
                  <span className="ml-1 text-gray-500">
                    ({logs.filter(l => l.level === level).length})
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {/* Logs */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
            {filteredLogs.length === 0 ? (
              <div className="text-gray-500 text-center mt-8">
                No logs to display
              </div>
            ) : (
              filteredLogs.map(log => (
                <div key={log.id} className="mb-1">
                  <span className="text-gray-500">[{log.timestamp}]</span>
                  <span className={`ml-1 ${levelColors[log.level as keyof typeof levelColors]}`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="ml-1 text-gray-300 break-all">
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
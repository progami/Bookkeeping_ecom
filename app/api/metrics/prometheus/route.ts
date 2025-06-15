import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { structuredLogger } from '@/lib/logger';

/**
 * Prometheus-compatible metrics endpoint
 * Returns metrics in Prometheus text exposition format
 */
export async function GET() {
  try {
    const metrics: string[] = [];
    
    // Helper to add metric
    const addMetric = (name: string, help: string, type: string, value: number, labels?: Record<string, string>) => {
      if (!metrics.find(m => m.startsWith(`# HELP ${name}`))) {
        metrics.push(`# HELP ${name} ${help}`);
        metrics.push(`# TYPE ${name} ${type}`);
      }
      
      const labelStr = labels 
        ? '{' + Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
        : '';
      
      metrics.push(`${name}${labelStr} ${value}`);
    };
    
    // Process metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    addMetric('nodejs_heap_size_total_bytes', 'Process heap size', 'gauge', memUsage.heapTotal);
    addMetric('nodejs_heap_size_used_bytes', 'Process heap used', 'gauge', memUsage.heapUsed);
    addMetric('nodejs_external_memory_bytes', 'Process external memory', 'gauge', memUsage.external);
    addMetric('process_cpu_user_seconds_total', 'Total user CPU time spent', 'counter', cpuUsage.user / 1000000);
    addMetric('process_cpu_system_seconds_total', 'Total system CPU time spent', 'counter', cpuUsage.system / 1000000);
    addMetric('process_uptime_seconds', 'Process uptime', 'gauge', process.uptime());
    
    // Database metrics
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;
      
      addMetric('database_up', 'Database connection status', 'gauge', 1);
      addMetric('database_query_duration_milliseconds', 'Database query latency', 'gauge', dbLatency, { query: 'health_check' });
      
      // Application data metrics
      const [transactionCount, invoiceCount, glAccountCount, syncLogStats] = await Promise.all([
        prisma.bankTransaction.count(),
        prisma.syncedInvoice.count(),
        prisma.gLAccount.count(),
        prisma.syncLog.groupBy({
          by: ['status'],
          _count: true
        })
      ]);
      
      addMetric('bookkeeping_bank_transactions_total', 'Total bank transactions', 'gauge', transactionCount);
      addMetric('bookkeeping_invoices_total', 'Total invoices', 'gauge', invoiceCount);
      addMetric('bookkeeping_gl_accounts_total', 'Total GL accounts', 'gauge', glAccountCount);
      
      // Sync metrics by status
      for (const stat of syncLogStats) {
        addMetric('bookkeeping_syncs_total', 'Total sync operations', 'counter', stat._count, { status: stat.status });
      }
      
    } catch (error) {
      addMetric('database_up', 'Database connection status', 'gauge', 0);
      structuredLogger.error('Database metrics collection failed', error, { component: 'prometheus-metrics' });
    }
    
    // Redis metrics
    if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://disabled') {
      try {
        const redisInfo = await redis.info();
        const lines = redisInfo.split('\r\n');
        
        let usedMemory = 0;
        let connectedClients = 0;
        let totalCommands = 0;
        
        for (const line of lines) {
          const [key, value] = line.split(':');
          if (key === 'used_memory') usedMemory = parseInt(value);
          if (key === 'connected_clients') connectedClients = parseInt(value);
          if (key === 'total_commands_processed') totalCommands = parseInt(value);
        }
        
        addMetric('redis_up', 'Redis connection status', 'gauge', 1);
        addMetric('redis_memory_used_bytes', 'Redis memory usage', 'gauge', usedMemory);
        addMetric('redis_connected_clients', 'Redis connected clients', 'gauge', connectedClients);
        addMetric('redis_commands_processed_total', 'Redis total commands processed', 'counter', totalCommands);
        
      } catch (error) {
        addMetric('redis_up', 'Redis connection status', 'gauge', 0);
      }
    }
    
    // HTTP metrics (would be collected by middleware in production)
    addMetric('http_requests_total', 'Total HTTP requests', 'counter', 0, { method: 'GET', status: '200' });
    addMetric('http_request_duration_milliseconds', 'HTTP request duration', 'histogram', 0);
    
    // Join all metrics with newlines
    const responseText = metrics.join('\n') + '\n';
    
    return new NextResponse(responseText, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    structuredLogger.error('Failed to generate Prometheus metrics', error, { component: 'prometheus-metrics' });
    return NextResponse.json({
      error: 'Failed to generate metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
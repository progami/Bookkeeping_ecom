import { NextRequest, NextResponse } from 'next/server';
import { memoryMonitor } from '@/lib/memory-monitor';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session }) => {
    try {
      const stats = memoryMonitor.getMemoryStats();
      
      // Get process info
      const uptime = process.uptime();
      const cpuUsage = process.cpuUsage();
      
      // Format uptime
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      
      return NextResponse.json({
        memory: {
          heapUsedMB: stats.heapUsedMB,
          heapTotalMB: stats.heapTotalMB,
          externalMB: stats.externalMB,
          rssMB: stats.rssMB,
          percentUsed: Math.round(stats.percentUsed * 100),
          status: stats.percentUsed > 0.9 ? 'critical' : 
                  stats.percentUsed > 0.8 ? 'high' : 
                  stats.percentUsed > 0.6 ? 'moderate' : 'normal'
        },
        process: {
          uptime: `${hours}h ${minutes}m ${seconds}s`,
          uptimeSeconds: uptime,
          cpuUser: Math.round(cpuUsage.user / 1000000), // Convert to seconds
          cpuSystem: Math.round(cpuUsage.system / 1000000),
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch
        },
        recommendations: getMemoryRecommendations(stats),
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Error fetching memory stats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch memory statistics' },
        { status: 500 }
      );
    }
  }
);

function getMemoryRecommendations(stats: any): string[] {
  const recommendations: string[] = [];
  
  if (stats.percentUsed > 0.9) {
    recommendations.push('Critical memory usage! Consider restarting the application.');
    recommendations.push('Check for memory leaks in long-running operations.');
  } else if (stats.percentUsed > 0.8) {
    recommendations.push('High memory usage detected. Monitor closely.');
    recommendations.push('Consider increasing heap size or optimizing large data operations.');
  }
  
  if (stats.externalMB > 100) {
    recommendations.push('High external memory usage. Check for large buffer allocations.');
  }
  
  if (stats.rssMB > stats.heapTotalMB * 2) {
    recommendations.push('RSS significantly higher than heap. Check for native memory leaks.');
  }
  
  return recommendations;
}
import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { structuredLogger } from '@/lib/logger';
import { wrapApiHandler } from '@/lib/api-error-wrapper';

async function GET(
  request: NextRequest,
  { params }: { params: { syncId: string } }
) {
  try {
    const { syncId } = params;
    
    // Load checkpoint from Redis
    const key = `sync:checkpoint:${syncId}`;
    const checkpointData = await redis.get(key);
    
    if (!checkpointData) {
      return NextResponse.json({ exists: false });
    }
    
    const checkpoint = JSON.parse(checkpointData);
    
    return NextResponse.json({
      exists: true,
      checkpoint: {
        timestamp: checkpoint.timestamp,
        lastCompletedEntity: checkpoint.lastCompletedEntity,
        processedCounts: checkpoint.processedCounts,
        completedBankAccounts: checkpoint.completedBankAccounts?.length || 0
      }
    });
  } catch (error) {
    structuredLogger.error('Failed to retrieve checkpoint', error, { 
      syncId: params.syncId,
      component: 'checkpoint-api'
    });
    
    return NextResponse.json(
      { error: 'Failed to retrieve checkpoint status' },
      { status: 500 }
    );
  }
}

export { GET };
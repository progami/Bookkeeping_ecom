import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'startSync') {
      // Create a sync log entry
      const syncLog = await prisma.syncLog.create({
        data: {
          syncType: 'simulated_sync',
          status: 'in_progress',
          recordsCreated: 0,
          recordsUpdated: 0,
          startedAt: new Date()
        }
      });

      // Simulate sync progress
      setTimeout(async () => {
        const itemsSynced = Math.floor(Math.random() * 1000) + 100;
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'success',
            completedAt: new Date(),
            recordsCreated: Math.floor(itemsSynced * 0.7),
            recordsUpdated: Math.floor(itemsSynced * 0.3),
            errorMessage: null
          }
        });
      }, 5000);

      return NextResponse.json({
        success: true,
        syncId: syncLog.id,
        message: 'Sync started'
      });
    }

    if (action === 'checkSync') {
      const latestSync = await prisma.syncLog.findFirst({
        orderBy: { startedAt: 'desc' }
      });

      return NextResponse.json({
        currentSync: latestSync,
        isRunning: latestSync?.status === 'in_progress'
      });
    }

    if (action === 'simulateError') {
      // Create a failed sync
      const syncLog = await prisma.syncLog.create({
        data: {
          syncType: 'simulated_sync',
          status: 'failed',
          recordsCreated: 0,
          recordsUpdated: 0,
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: 'Simulated sync error: Connection timeout'
        }
      });

      return NextResponse.json({
        success: false,
        error: 'Sync failed',
        syncId: syncLog.id
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test sync failed',
      message: error.message
    }, { status: 500 });
  }
}
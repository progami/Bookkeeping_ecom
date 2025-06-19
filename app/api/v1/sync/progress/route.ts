import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { getSyncProgress } from '@/lib/sync-progress-manager';

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session, logger }) => {
    try {
      // Get the latest sync log
      const latestSync = await prisma.syncLog.findFirst({
        orderBy: { startedAt: 'desc' }
      });

      if (!latestSync) {
        return NextResponse.json({ 
          status: 'no_sync',
          message: 'No sync has been initiated'
        });
      }

      // Get real-time progress if sync is in progress
      if (latestSync.status === 'in_progress') {
        logger.info('Fetching progress for in-progress sync', {
          syncId: latestSync.id,
          startedAt: latestSync.startedAt
        });
        
        const progress = await getSyncProgress(latestSync.id);
        
        logger.info('Progress fetched from Redis', {
          syncId: latestSync.id,
          hasProgress: !!progress,
          progressStatus: progress?.status,
          percentage: progress?.percentage
        });
        
        // If no progress found, return basic status
        if (!progress) {
          return NextResponse.json({
            status: 'in_progress',
            syncId: latestSync.id,
            startedAt: latestSync.startedAt,
            steps: {
              accounts: { status: 'pending', count: 0 },
              transactions: { status: 'pending', count: 0 },
              invoices: { status: 'pending', count: 0 },
              bills: { status: 'pending', count: 0 },
              contacts: { status: 'pending', count: 0 }
            },
            currentStep: 'Initializing...',
            percentage: 0
          });
        }

        return NextResponse.json(progress);
      }

      // Return completed sync info
      return NextResponse.json({
        status: latestSync.status,
        syncId: latestSync.id,
        startedAt: latestSync.startedAt,
        completedAt: latestSync.completedAt,
        itemsSynced: latestSync.recordsCreated + latestSync.recordsUpdated,
        errorMessage: latestSync.errorMessage,
        percentage: 100
      });

    } catch (error: any) {
      logger.error('Error fetching sync progress', error);
      return NextResponse.json(
        { error: 'Failed to fetch sync progress' },
        { status: 500 }
      );
    }
  }
);


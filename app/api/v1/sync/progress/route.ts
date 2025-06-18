import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { syncProgressStore } from '@/lib/sync-progress-manager';

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session }) => {
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
        const progress = syncProgressStore.get(latestSync.id) || {
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
        };

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
      console.error('Error fetching sync progress:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sync progress' },
        { status: 500 }
      );
    }
  }
);


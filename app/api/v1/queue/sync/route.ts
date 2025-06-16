import { NextRequest, NextResponse } from 'next/server';
import { getQueue, PRIORITY_LEVELS } from '@/lib/queue/queue-config';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';

export const POST = withAuthValidation(
  { authLevel: ValidationLevel.XERO },
  async (request, { session }) => {
    try {
      const body = await request.json();
      const {
        syncType = 'incremental',
        priority = PRIORITY_LEVELS.NORMAL,
        options = {}
      } = body;

      // Validate sync type
      const validSyncTypes = ['full', 'incremental', 'transactions', 'invoices', 'contacts'];
      if (!validSyncTypes.includes(syncType)) {
        return NextResponse.json(
          { error: 'Invalid sync type' },
          { status: 400 }
        );
      }

      // Add sync job to queue
      const queue = getQueue('xero-sync');
      const job = await queue.add('sync', {
        userId: session.user.userId,
        tenantId: session.user.tenantId,
        syncType,
        options
      }, {
        priority,
        delay: options.delay || 0
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        syncType,
        status: 'queued',
        message: `${syncType} sync job has been queued`
      });

    } catch (error: any) {
      console.error('Error queuing sync job:', error);
      return NextResponse.json(
        { error: 'Failed to queue sync job', message: error.message },
        { status: 500 }
      );
    }
  }
);

export const GET = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session }) => {
    try {
      const queue = getQueue('xero-sync');
      
      // Get job counts
      const jobCounts = await queue.getJobCounts();
      
      // Get recent jobs
      const [waiting, active, completed, failed] = await Promise.all([
        queue.getWaiting(0, 5),
        queue.getActive(0, 5),
        queue.getCompleted(0, 5),
        queue.getFailed(0, 5)
      ]);

      return NextResponse.json({
        queue: 'xero-sync',
        counts: jobCounts,
        jobs: {
          waiting: waiting.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            priority: job.opts.priority
          })),
          active: active.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            progress: job.progress
          })),
          completed: completed.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            returnvalue: job.returnvalue
          })),
          failed: failed.map(job => ({
            id: job.id,
            data: job.data,
            timestamp: job.timestamp,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade
          }))
        }
      });

    } catch (error: any) {
      console.error('Error fetching queue status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch queue status', message: error.message },
        { status: 500 }
      );
    }
  }
);
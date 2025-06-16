import { NextRequest, NextResponse } from 'next/server';
import { getQueue, QUEUE_NAMES } from '@/lib/queue/queue-config';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';

// Dynamic route handler for /api/v1/queue/job/[jobId]
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  return withAuthValidation(
    { authLevel: ValidationLevel.USER },
    async (request: NextRequest, context: any) => {
      try {
        const { jobId } = params;
      
      // Search for job in all queues
      let jobInfo = null;
      let queueName = '';

      for (const name of Object.values(QUEUE_NAMES)) {
        const queue = getQueue(name);
        const job = await queue.getJob(jobId);
        
        if (job) {
          queueName = name;
          const state = await job.getState();
          
          jobInfo = {
            id: job.id,
            queue: queueName,
            state,
            data: job.data,
            progress: job.progress,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            failedReason: job.failedReason,
            attemptsMade: job.attemptsMade,
            opts: job.opts,
            returnvalue: job.returnvalue
          };
          break;
        }
      }

      if (!jobInfo) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(jobInfo);

    } catch (error: any) {
      console.error('Error fetching job status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch job status', message: error.message },
        { status: 500 }
      );
    }
  }
  )(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  return withAuthValidation(
    { authLevel: ValidationLevel.ADMIN },
    async (request: NextRequest, context: any) => {
      try {
        const { jobId } = params;
      
      // Search for job in all queues
      let deleted = false;

      for (const name of Object.values(QUEUE_NAMES)) {
        const queue = getQueue(name);
        const job = await queue.getJob(jobId);
        
        if (job) {
          await job.remove();
          deleted = true;
          
          return NextResponse.json({
            success: true,
            message: `Job ${jobId} removed from ${name} queue`
          });
        }
      }

      if (!deleted) {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      
      // This should never be reached but TypeScript needs it
      return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });

    } catch (error: any) {
      console.error('Error deleting job:', error);
      return NextResponse.json(
        { error: 'Failed to delete job', message: error.message },
        { status: 500 }
      );
    }
  }
  )(request);
}
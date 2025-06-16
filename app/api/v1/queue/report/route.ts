import { NextRequest, NextResponse } from 'next/server';
import { getQueue, PRIORITY_LEVELS } from '@/lib/queue/queue-config';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';

export const POST = withAuthValidation(
  { authLevel: ValidationLevel.USER },
  async (request, { session }) => {
    try {
      const body = await request.json();
      const {
        reportType,
        period,
        format = 'pdf',
        priority = PRIORITY_LEVELS.NORMAL,
        options = {}
      } = body;

      // Validate report type
      const validReportTypes = ['profit-loss', 'balance-sheet', 'cash-flow', 'tax-summary'];
      if (!validReportTypes.includes(reportType)) {
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        );
      }

      // Validate format
      const validFormats = ['pdf', 'excel', 'csv'];
      if (!validFormats.includes(format)) {
        return NextResponse.json(
          { error: 'Invalid format' },
          { status: 400 }
        );
      }

      // Validate period
      if (!period || !period.startDate || !period.endDate) {
        return NextResponse.json(
          { error: 'Period with startDate and endDate is required' },
          { status: 400 }
        );
      }

      // Add report generation job to queue
      const queue = getQueue('report-generation');
      const job = await queue.add('generate-report', {
        userId: session.user.userId,
        reportType,
        period,
        format,
        options
      }, {
        priority,
        delay: options.delay || 0
      });

      return NextResponse.json({
        success: true,
        jobId: job.id,
        reportType,
        format,
        status: 'queued',
        message: `${reportType} report generation has been queued`
      });

    } catch (error: any) {
      console.error('Error queuing report generation:', error);
      return NextResponse.json(
        { error: 'Failed to queue report generation', message: error.message },
        { status: 500 }
      );
    }
  }
);
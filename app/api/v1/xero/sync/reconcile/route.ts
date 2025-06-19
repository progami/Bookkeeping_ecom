import { NextRequest, NextResponse } from 'next/server';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { performReconciliationSync } from '@/lib/sync-reconciliation';
import { structuredLogger } from '@/lib/logger';
import { withRateLimit } from '@/lib/rate-limiter';

export const POST = withRateLimit(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      try {
        structuredLogger.info('[Reconciliation API] Starting reconciliation sync', {
          userId: session.user.userId
        });

        // Parse request body for optional date range
        const body = await request.json().catch(() => ({}));
        const options = {
          fromDate: body.fromDate ? new Date(body.fromDate) : undefined,
          toDate: body.toDate ? new Date(body.toDate) : undefined
        };

        // Perform reconciliation
        const results = await performReconciliationSync(
          session.user.userId,
          options
        );

        return NextResponse.json({
          success: true,
          message: 'Reconciliation sync completed successfully',
          results
        });
      } catch (error: any) {
        structuredLogger.error('[Reconciliation API] Reconciliation failed', error, {
          userId: session?.user?.userId
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Reconciliation sync failed',
            message: error.message
          },
          { status: 500 }
        );
      }
    }
  ),
  { 
    maxRequests: 5,
    windowMs: 60 * 60 * 1000 // 5 requests per hour
  }
);
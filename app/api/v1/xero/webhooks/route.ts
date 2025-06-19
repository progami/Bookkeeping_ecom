import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { apiWrapper, ApiErrors, successResponse } from '@/lib/errors/api-error-wrapper';
import { structuredLogger } from '@/lib/logger';
import { xeroWebhookSchema } from '@/lib/validation/schemas';
import { getQueue, QUEUE_NAMES, WebhookProcessingJob, PRIORITY_LEVELS } from '@/lib/queue/queue-config';
import { ValidationLevel } from '@/lib/auth/session-validation';

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;
  if (!webhookKey) {
    structuredLogger.error('Webhook key not configured', undefined, { component: 'xero-webhooks' });
    return false;
  }

  const hash = crypto
    .createHmac('sha256', webhookKey)
    .update(payload)
    .digest('base64');

  return hash === signature;
}

// Intent to Receive (ITR) - Xero webhook verification
export const POST = apiWrapper(
  async (request) => {
    const signature = request.headers.get('x-xero-signature');
    const rawBody = await request.text();

    // Handle Intent to Receive
    if (!rawBody || rawBody === '') {
      structuredLogger.info('Webhook ITR received', { component: 'xero-webhooks' });
      return successResponse({ status: 'ok' });
    }

    // Verify signature
    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      structuredLogger.warn('Invalid webhook signature', { 
        component: 'xero-webhooks',
        hasSignature: !!signature 
      });
      throw ApiErrors.unauthorized();
    }

    // Parse webhook payload
    const webhookData = xeroWebhookSchema.parse(JSON.parse(rawBody));
    
    structuredLogger.info('Webhook received', {
      component: 'xero-webhooks',
      eventCount: webhookData.events.length,
      firstSequence: webhookData.firstEventSequence,
      lastSequence: webhookData.lastEventSequence
    });

    // Get the webhook processing queue
    const webhookQueue = getQueue<WebhookProcessingJob>(QUEUE_NAMES.WEBHOOK_PROCESSING);
    
    // Queue events for processing
    const jobs = await Promise.all(
      webhookData.events.map((event, index) => 
        webhookQueue.add(
          `webhook-${event.eventCategory}-${event.resourceId}`,
          {
            webhookId: `${webhookData.firstEventSequence}-${index}`,
            eventType: event.eventType,
            payload: event,
            retryCount: 0
          },
          {
            priority: event.eventCategory === 'BANKTRANSACTION' 
              ? PRIORITY_LEVELS.HIGH 
              : PRIORITY_LEVELS.NORMAL,
            delay: index * 100 // Stagger processing by 100ms
          }
        )
      )
    );

    structuredLogger.info('Webhook events queued', {
      component: 'xero-webhooks',
      jobCount: jobs.length,
      jobIds: jobs.map(j => j.id)
    });

    // Return immediately to acknowledge receipt
    return successResponse({ 
      status: 'ok',
      queued: jobs.length
    });
  },
  {
    authLevel: ValidationLevel.NONE, // Webhooks are public endpoints
    endpoint: '/api/v1/xero/webhooks'
  }
);

// Webhook monitoring endpoint
export const GET = apiWrapper(
  async (request) => {
    const webhookQueue = getQueue<WebhookProcessingJob>(QUEUE_NAMES.WEBHOOK_PROCESSING);
    
    // Get queue stats
    const [jobCounts, isPaused, workers] = await Promise.all([
      webhookQueue.getJobCounts(),
      webhookQueue.isPaused(),
      webhookQueue.getWorkers()
    ]);
    
    return successResponse({
      queue: QUEUE_NAMES.WEBHOOK_PROCESSING,
      status: isPaused ? 'paused' : 'active',
      jobs: jobCounts,
      workers: workers.length
    });
  },
  {
    authLevel: ValidationLevel.XERO,
    endpoint: '/api/v1/xero/webhooks'
  }
);
import { Worker, Job } from 'bullmq';
import { EmailNotificationJob, createRedisConnection } from '../queue-config';
import { structuredLogger } from '@/lib/logger';

// Email templates
const emailTemplates = {
  'sync-complete': {
    subject: 'Xero Sync Completed',
    template: `
      <h2>Sync Completed Successfully</h2>
      <p>Your Xero data sync has been completed.</p>
      <ul>
        <li>Records Created: {{created}}</li>
        <li>Records Updated: {{updated}}</li>
        <li>Duration: {{duration}}</li>
      </ul>
      <p>You can view the updated data in your dashboard.</p>
    `
  },
  'error-alert': {
    subject: 'Error Alert: {{errorType}}',
    template: `
      <h2>Error Detected</h2>
      <p>An error occurred in your bookkeeping system:</p>
      <p><strong>Error:</strong> {{errorMessage}}</p>
      <p><strong>Time:</strong> {{timestamp}}</p>
      <p>Please check your dashboard for more details.</p>
    `
  },
  'report-ready': {
    subject: 'Your {{reportType}} Report is Ready',
    template: `
      <h2>Report Generated</h2>
      <p>Your {{reportType}} report has been generated successfully.</p>
      <p><strong>Period:</strong> {{startDate}} to {{endDate}}</p>
      <p><a href="{{downloadLink}}">Download Report</a></p>
      <p>This link will expire in 7 days.</p>
    `
  },
  'welcome': {
    subject: 'Welcome to Bookkeeping',
    template: `
      <h2>Welcome {{name}}!</h2>
      <p>Thank you for connecting your Xero account.</p>
      <p>We're now syncing your data. This may take a few minutes.</p>
      <p>Here's what you can do:</p>
      <ul>
        <li>View your financial overview</li>
        <li>Access detailed analytics</li>
        <li>Generate custom reports</li>
        <li>Export your data</li>
      </ul>
      <p>If you have any questions, please don't hesitate to contact support.</p>
    `
  }
};

export function createEmailNotificationWorker() {
  const worker = new Worker<EmailNotificationJob>(
    'email-notifications',
    async (job: Job<EmailNotificationJob>) => {
      const { to, subject, template, data } = job.data;

      try {
        structuredLogger.info('Processing email notification', {
          component: 'email-processor',
          jobId: job.id,
          to,
          template
        });

        // Get template
        const emailTemplate = emailTemplates[template];
        if (!emailTemplate) {
          throw new Error(`Unknown email template: ${template}`);
        }

        // Process subject and body
        const processedSubject = processTemplate(subject || emailTemplate.subject, data);
        const processedBody = processTemplate(emailTemplate.template, data);

        // In production, integrate with email service (SendGrid, AWS SES, etc.)
        // For now, we'll just log the email
        const emailData = {
          to,
          subject: processedSubject,
          html: wrapInEmailLayout(processedBody),
          text: stripHtml(processedBody)
        };

        // Simulate sending email
        await simulateSendEmail(emailData);

        structuredLogger.info('Email sent successfully', {
          component: 'email-processor',
          jobId: job.id,
          to,
          subject: processedSubject
        });

        return {
          success: true,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

      } catch (error) {
        structuredLogger.error('Failed to send email', error, {
          component: 'email-processor',
          jobId: job.id,
          to
        });
        throw error;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5, // Process 5 emails simultaneously
      limiter: {
        max: 50,
        duration: 60000 // 50 emails per minute
      }
    }
  );

  worker.on('completed', (job) => {
    structuredLogger.info('Email notification sent', {
      component: 'email-processor',
      jobId: job.id
    });
  });

  worker.on('failed', (job, err) => {
    structuredLogger.error('Email notification failed', err, {
      component: 'email-processor',
      jobId: job?.id
    });
  });

  return worker;
}

// Helper functions
function processTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}

function wrapInEmailLayout(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bookkeeping Notification</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            background: #6366F1;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
          }
          .content {
            padding: 30px;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-radius: 0 0 8px 8px;
          }
          h2 {
            margin-top: 0;
            color: #6366F1;
          }
          a {
            color: #6366F1;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          ul {
            padding-left: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: #6366F1;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bookkeeping</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>&copy; 2025 Bookkeeping. All rights reserved.</p>
            <p>
              <a href="#">Unsubscribe</a> | 
              <a href="#">Update Preferences</a> | 
              <a href="#">Privacy Policy</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function simulateSendEmail(emailData: any): Promise<void> {
  // In production, replace with actual email service integration
  // For example:
  // - SendGrid: await sendgrid.send(emailData)
  // - AWS SES: await ses.sendEmail(emailData).promise()
  // - Postmark: await postmark.sendEmail(emailData)
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Log email for development
  structuredLogger.info('Email sent (simulated)', {
    component: 'email-processor',
    ...emailData
  });
}
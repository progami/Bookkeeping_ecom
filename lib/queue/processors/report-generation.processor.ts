import { Worker, Job } from 'bullmq';
import { ReportGenerationJob, createRedisConnection, getQueue } from '../queue-config';
import { structuredLogger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { memoryMonitor } from '@/lib/memory-monitor';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs/promises';

export function createReportGenerationWorker() {
  const worker = new Worker<ReportGenerationJob>(
    'report-generation',
    async (job: Job<ReportGenerationJob>) => {
      return memoryMonitor.monitorOperation('report-generation', async () => {
        const { userId, reportType, period, format: outputFormat, options } = job.data;

        try {
          structuredLogger.info('Starting report generation', {
            component: 'report-processor',
            jobId: job.id,
            userId,
            reportType
          });

          // Get Xero client
          const xeroData = await getXeroClientWithTenant();
          if (!xeroData) {
            throw new Error('Failed to get Xero client');
          }

          const { client: xero, tenantId } = xeroData;

          // Update progress
          await job.updateProgress(20);

          // Generate report data
          let reportData;
          switch (reportType) {
            case 'profit-loss':
              reportData = await generateProfitLossReport(xero, tenantId, period);
              break;
            case 'balance-sheet':
              reportData = await generateBalanceSheetReport(xero, tenantId, period);
              break;
            case 'cash-flow':
              reportData = await generateCashFlowReport(xero, tenantId, period);
              break;
            case 'tax-summary':
              reportData = await generateTaxSummaryReport(xero, tenantId, period);
              break;
            default:
              throw new Error(`Unknown report type: ${reportType}`);
          }

          await job.updateProgress(60);

          // Format report
          let filePath;
          switch (outputFormat) {
            case 'pdf':
              filePath = await generatePdfReport(reportData, reportType, period);
              break;
            case 'excel':
              filePath = await generateExcelReport(reportData, reportType, period);
              break;
            case 'csv':
              filePath = await generateCsvReport(reportData, reportType, period);
              break;
            default:
              throw new Error(`Unknown format: ${outputFormat}`);
          }

          await job.updateProgress(90);

          // Store report metadata in database
          const report = await prisma.report.create({
            data: {
              userId,
              type: reportType,
              format: outputFormat,
              startDate: new Date(period.startDate),
              endDate: new Date(period.endDate),
              filePath,
              fileSize: (await fs.stat(filePath)).size,
              status: 'completed',
              generatedAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
          });

          // Queue email notification
          const emailQueue = getQueue('email-notifications');
          await emailQueue.add('report-ready', {
            to: await getUserEmail(userId),
            template: 'report-ready',
            subject: `Your ${reportType} Report is Ready`,
            data: {
              reportType: reportType.replace('-', ' ').toUpperCase(),
              startDate: format(new Date(period.startDate), 'MMM dd, yyyy'),
              endDate: format(new Date(period.endDate), 'MMM dd, yyyy'),
              downloadLink: `/api/v1/reports/download/${report.id}`
            }
          });

          await job.updateProgress(100);

          structuredLogger.info('Report generation completed', {
            component: 'report-processor',
            jobId: job.id,
            reportId: report.id,
            filePath
          });

          return {
            reportId: report.id,
            filePath,
            downloadUrl: `/api/v1/reports/download/${report.id}`
          };

        } catch (error) {
          structuredLogger.error('Report generation failed', error, {
            component: 'report-processor',
            jobId: job.id,
            userId
          });
          throw error;
        }
      });
    },
    {
      connection: createRedisConnection(),
      concurrency: 3, // Process 3 reports simultaneously
      limiter: {
        max: 10,
        duration: 300000 // 10 reports per 5 minutes
      }
    }
  );

  return worker;
}

// Report generation functions
async function generateProfitLossReport(xero: any, tenantId: string, period: any) {
  const response = await xero.accountingApi.getReportProfitAndLoss(
    tenantId,
    period.startDate,
    period.endDate,
    undefined,
    undefined,
    undefined,
    true
  );

  const report = response.body.reports?.[0];
  if (!report) throw new Error('No profit and loss data available');

  return {
    reportId: report.reportID,
    reportName: report.reportName,
    reportType: report.reportType,
    reportDate: report.reportDate,
    rows: parseReportRows(report.rows || [])
  };
}

async function generateBalanceSheetReport(xero: any, tenantId: string, period: any) {
  const response = await xero.accountingApi.getReportBalanceSheet(
    tenantId,
    period.endDate,
    undefined,
    undefined,
    undefined,
    true
  );

  const report = response.body.reports?.[0];
  if (!report) throw new Error('No balance sheet data available');

  return {
    reportId: report.reportID,
    reportName: report.reportName,
    reportType: report.reportType,
    reportDate: report.reportDate,
    rows: parseReportRows(report.rows || [])
  };
}

async function generateCashFlowReport(xero: any, tenantId: string, period: any) {
  // For cash flow, we need to calculate from transactions
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      date: {
        gte: new Date(period.startDate),
        lte: new Date(period.endDate)
      }
    },
    include: {
      bankAccount: true,
      contact: true
    },
    orderBy: { date: 'asc' }
  });

  // Calculate cash flow
  const cashFlow = {
    operating: { inflow: 0, outflow: 0 },
    investing: { inflow: 0, outflow: 0 },
    financing: { inflow: 0, outflow: 0 }
  };

  transactions.forEach(transaction => {
    const amount = transaction.total;
    const category = categorizeTransaction(transaction);
    
    if (transaction.type === 'RECEIVE') {
      cashFlow[category].inflow += amount;
    } else {
      cashFlow[category].outflow += amount;
    }
  });

  return {
    reportName: 'Cash Flow Statement',
    reportType: 'CashFlow',
    period,
    data: cashFlow,
    transactions: transactions.length
  };
}

async function generateTaxSummaryReport(xero: any, tenantId: string, period: any) {
  // Get all transactions with tax
  const response = await xero.accountingApi.getReportBASorGST(
    tenantId,
    period.startDate,
    period.endDate
  );

  const report = response.body.reports?.[0];
  if (!report) {
    // Fallback to manual calculation
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: new Date(period.startDate),
          lte: new Date(period.endDate)
        },
        totalTax: { gt: 0 }
      }
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        date: {
          gte: new Date(period.startDate),
          lte: new Date(period.endDate)
        },
        totalTax: { gt: 0 }
      }
    });

    const taxSummary = {
      salesTax: invoices.filter(i => i.type === 'ACCREC').reduce((sum, i) => sum + i.totalTax, 0),
      purchaseTax: invoices.filter(i => i.type === 'ACCPAY').reduce((sum, i) => sum + i.totalTax, 0),
      transactionTax: transactions.reduce((sum, t) => sum + t.totalTax, 0)
    };

    return {
      reportName: 'Tax Summary',
      reportType: 'TaxSummary',
      period,
      data: taxSummary
    };
  }

  return {
    reportId: report.reportID,
    reportName: report.reportName,
    reportType: report.reportType,
    reportDate: report.reportDate,
    rows: parseReportRows(report.rows || [])
  };
}

// Helper functions
function parseReportRows(rows: any[]): any[] {
  return rows.map(row => ({
    rowType: row.rowType,
    title: row.title,
    cells: row.cells?.map((cell: any) => ({
      value: cell.value,
      attributes: cell.attributes
    }))
  }));
}

function categorizeTransaction(transaction: any): 'operating' | 'investing' | 'financing' {
  // Simple categorization logic - in production, use more sophisticated rules
  const description = (transaction.reference || '').toLowerCase();
  
  if (description.includes('loan') || description.includes('dividend')) {
    return 'financing';
  } else if (description.includes('equipment') || description.includes('asset')) {
    return 'investing';
  }
  
  return 'operating';
}

async function getUserEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  
  return user?.email || 'noreply@bookkeeping.app';
}

// Report formatting functions (simplified - in production use proper libraries)
async function generatePdfReport(data: any, reportType: string, period: any): Promise<string> {
  // In production, use libraries like puppeteer, pdfkit, or jsPDF
  const fileName = `${reportType}_${Date.now()}.pdf`;
  const filePath = path.join(process.cwd(), 'reports', fileName);
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // For now, just save JSON data
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  return filePath;
}

async function generateExcelReport(data: any, reportType: string, period: any): Promise<string> {
  // In production, use libraries like exceljs or xlsx
  const fileName = `${reportType}_${Date.now()}.xlsx`;
  const filePath = path.join(process.cwd(), 'reports', fileName);
  
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  return filePath;
}

async function generateCsvReport(data: any, reportType: string, period: any): Promise<string> {
  // In production, properly format as CSV
  const fileName = `${reportType}_${Date.now()}.csv`;
  const filePath = path.join(process.cwd(), 'reports', fileName);
  
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // Simple CSV generation
  let csv = '';
  if (data.rows) {
    data.rows.forEach((row: any) => {
      if (row.cells) {
        csv += row.cells.map((cell: any) => cell.value).join(',') + '\n';
      }
    });
  } else {
    csv = JSON.stringify(data, null, 2);
  }
  
  await fs.writeFile(filePath, csv);
  
  return filePath;
}
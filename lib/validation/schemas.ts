import { z } from 'zod';

// Common schemas
export const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(1000)).optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional()
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// Transaction schemas
export const transactionsQuerySchema = paginationSchema.extend({
  accountId: z.string().optional(),
  status: z.enum(['RECONCILED', 'UNRECONCILED', 'ALL']).optional(),
  type: z.enum(['SPEND', 'RECEIVE']).optional(),
  search: z.string().max(100).optional()
}).merge(dateRangeSchema);

export const transactionUpdateSchema = z.object({
  transactionId: z.string().min(1),
  accountCode: z.string().min(1).optional(),
  taxType: z.string().min(1).optional(),
  description: z.string().max(500).optional()
});

// Invoice schemas
export const invoicesQuerySchema = paginationSchema.extend({
  type: z.enum(['ACCREC', 'ACCPAY']).optional(),
  status: z.string().optional(),
  contactId: z.string().optional()
}).merge(dateRangeSchema);

// Report schemas
export const reportGenerationSchema = z.object({
  reportType: z.enum(['profit-loss', 'balance-sheet', 'cash-flow', 'tax-summary']),
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  format: z.enum(['pdf', 'excel', 'csv']).default('pdf'),
  options: z.object({
    includeDetails: z.boolean().optional(),
    groupBy: z.string().optional()
  }).optional()
});

// Sync schemas
export const syncRequestSchema = z.object({
  syncType: z.enum(['full', 'incremental', 'transactions', 'invoices', 'contacts']).default('incremental'),
  options: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    forceUpdate: z.boolean().optional()
  }).optional()
});

// Updated Xero sync schema to support selective imports
export const xeroSyncSchema = z.object({
  forceSync: z.boolean().optional(),
  syncOptions: z.object({
    // What to sync
    entities: z.array(z.enum(['accounts', 'transactions', 'invoices', 'bills', 'contacts'])).optional(),
    // Date range for transactions/invoices
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    // Specific account IDs to sync
    accountIds: z.array(z.string()).optional(),
    // Max items per entity type
    limits: z.object({
      transactions: z.number().min(1).max(10000).optional(),
      invoices: z.number().min(1).max(5000).optional(),
      bills: z.number().min(1).max(5000).optional(),
      contacts: z.number().min(1).max(10000).optional()
    }).optional()
  }).optional()
});

// GL Account schemas
export const glAccountSyncSchema = z.object({
  includeArchived: z.boolean().default(false)
});

// Bank account schemas
export const bankAccountSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(10).optional(),
  currencyCode: z.string().length(3).optional(),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional()
});

// Contact schemas
export const contactSchema = z.object({
  name: z.string().min(1).max(255),
  emailAddress: z.string().email().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  companyNumber: z.string().max(50).optional(),
  taxNumber: z.string().max(50).optional(),
  isSupplier: z.boolean().optional(),
  isCustomer: z.boolean().optional()
});

// Analytics schemas
export const topVendorsQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  period: z.enum(['30d', '90d', '1y', 'all']).optional(),
  minSpend: z.string().transform(Number).pipe(z.number().min(0)).optional()
});

export const insightsQuerySchema = z.object({
  period: z.enum(['current', 'previous', 'year']).optional(),
  compareWith: z.enum(['previous', 'year']).optional()
});

// Database schemas
export const tableQuerySchema = paginationSchema.extend({
  tableName: z.string().regex(/^[a-zA-Z_]+$/, 'Invalid table name')
});

// SOP schemas
export const sopSchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'Year must be 4 digits'),
  chartOfAccount: z.string().min(1).max(100),
  pointOfInvoice: z.string().max(100).optional(),
  serviceType: z.string().min(1).max(100),
  referenceTemplate: z.string().min(1).max(255),
  referenceExample: z.string().min(1).max(255),
  descriptionTemplate: z.string().min(1).max(500),
  descriptionExample: z.string().min(1).max(500),
  note: z.string().max(1000).optional(),
  isActive: z.boolean().default(true)
});

// Email notification schemas
export const emailNotificationSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  template: z.enum(['sync-complete', 'error-alert', 'report-ready', 'welcome']),
  data: z.record(z.any())
});

// Job queue schemas
export const jobQuerySchema = z.object({
  queue: z.enum(['xero-sync', 'email-notifications', 'report-generation']).optional(),
  status: z.enum(['waiting', 'active', 'completed', 'failed']).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional()
});

// Currency rate schemas
export const currencyRateSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.number().positive(),
  effectiveDate: z.string().datetime()
});

// Analytics period schema
export const analyticsPeriodSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '365d', 'all']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional()
});

// Signout schema
export const signoutSchema = z.object({
  global: z.boolean().optional()
});

// Bank transaction query schema (alias for transactionsQuerySchema)
export const bankTransactionQuerySchema = transactionsQuerySchema;

// Cash flow forecast schemas
export const cashFlowForecastQuerySchema = z.object({
  days: z.string().transform(Number).pipe(z.number().int().min(1).max(365)).optional(),
  scenarios: z.string().transform((val) => val === 'true').optional()
});

export const cashFlowForecastBodySchema = z.object({
  days: z.number().int().min(1).max(365).optional(),
  regenerate: z.boolean().optional()
});

// Accounts query schema
export const accountsQuerySchema = z.object({
  type: z.enum(['BANK', 'REVENUE', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY']).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  includeBalances: z.boolean().optional()
});

// Report query schema
export const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  periods: z.number().int().min(1).max(12).optional(),
  compareWith: z.enum(['previousPeriod', 'previousYear']).optional(),
  trackingCategories: z.string().optional()
});


// Xero webhook schema
export const xeroWebhookSchema = z.object({
  events: z.array(z.object({
    resourceUrl: z.string(),
    resourceId: z.string(),
    eventDateUtc: z.string(),
    eventType: z.string(),
    eventCategory: z.string(),
    tenantId: z.string(),
    tenantType: z.string()
  })),
  firstEventSequence: z.number().optional(),
  lastEventSequence: z.number().optional()
});
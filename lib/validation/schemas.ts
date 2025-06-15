import { z } from 'zod';

// Common schemas
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
export const yearSchema = z.string().regex(/^\d{4}$/, 'Year must be in YYYY format');
export const monthYearSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format');
export const emailSchema = z.string().email('Invalid email address');
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'Currency must be 3-letter ISO code');

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10)
});

// SOP Schema
export const createSOPSchema = z.object({
  year: yearSchema,
  chartOfAccount: z.string().min(1).max(100),
  serviceType: z.string().min(1).max(50),
  status: z.enum(['pending', 'approved', 'rejected']).default('pending')
});

export const updateSOPSchema = createSOPSchema.partial();

// Bank Transaction Schema
export const bankTransactionFilterSchema = z.object({
  accountId: z.string().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  isReconciled: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Cash Flow Budget Schema
export const cashFlowBudgetSchema = z.object({
  accountCode: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  category: z.enum(['REVENUE', 'EXPENSE', 'TAX', 'CAPITAL', 'OTHER']),
  monthYear: monthYearSchema,
  budgetedAmount: z.coerce.number(),
  actualAmount: z.coerce.number().default(0),
  notes: z.string().max(500).optional()
});

// Analytics Query Schema
export const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'ytd', 'custom']).default('30d'),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter']).optional()
});

export const analyticsPeriodSchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'year']).optional()
});

export const bankTransactionQuerySchema = z.object({
  page: z.coerce.number().min(1).optional(),
  pageSize: z.coerce.number().min(1).max(100).optional()
});

export const cashFlowForecastQuerySchema = z.object({
  days: z.coerce.number().min(1).max(365).optional(),
  scenarios: z.coerce.boolean().optional()
});

export const cashFlowForecastBodySchema = z.object({
  days: z.number().min(1).max(365).optional(),
  regenerate: z.boolean().optional()
});

// Xero Sync Schema
export const xeroSyncSchema = z.object({
  forceFullSync: z.boolean().default(false),
  syncType: z.enum(['invoices', 'contacts', 'bankTransactions', 'all']).optional()
});

// Webhook Schema
export const xeroWebhookSchema = z.object({
  events: z.array(z.object({
    resourceUrl: z.string().url(),
    resourceId: z.string().uuid(),
    eventDateUtc: z.string().datetime(),
    eventType: z.enum(['Create', 'Update', 'Delete']),
    eventCategory: z.enum(['INVOICE', 'CONTACT', 'PAYMENT', 'BANKTRANSACTION', 'BANKACCOUNT'])
  })),
  firstEventSequence: z.number().int(),
  lastEventSequence: z.number().int()
});

// Report Query Schema
export const reportQuerySchema = z.object({
  date: dateSchema.optional(),
  periods: z.coerce.number().int().min(1).max(12).optional(),
  timeframe: z.enum(['MONTH', 'QUARTER', 'YEAR']).optional(),
  trackingCategories: z.array(z.string()).optional()
});

// Tax Obligation Schema
export const taxObligationSchema = z.object({
  type: z.enum(['VAT', 'PAYE_NI', 'CORPORATION_TAX']),
  dueDate: z.string().datetime(),
  amount: z.coerce.number().positive(),
  status: z.enum(['PENDING', 'PAID']).default('PENDING'),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional()
});

// Database Query Schema (for table endpoint)
export const databaseQuerySchema = z.object({
  filters: z.record(z.string(), z.any()).optional(),
  orderBy: z.object({
    field: z.string(),
    direction: z.enum(['asc', 'desc'])
  }).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

// Export type inference helpers
export type CreateSOPInput = z.infer<typeof createSOPSchema>;
export type UpdateSOPInput = z.infer<typeof updateSOPSchema>;
export type BankTransactionFilter = z.infer<typeof bankTransactionFilterSchema>;
export type CashFlowBudgetInput = z.infer<typeof cashFlowBudgetSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export type XeroSyncInput = z.infer<typeof xeroSyncSchema>;
export type XeroWebhookPayload = z.infer<typeof xeroWebhookSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type TaxObligationInput = z.infer<typeof taxObligationSchema>;
export type DatabaseQuery = z.infer<typeof databaseQuerySchema>;
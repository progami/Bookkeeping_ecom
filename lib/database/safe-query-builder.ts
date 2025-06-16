import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Safe query builder utilities to prevent SQL injection
 * These utilities ensure all dynamic queries are properly sanitized
 */

// Whitelist of allowed table names
const ALLOWED_TABLES = [
  'user',
  'bankAccount',
  'bankTransaction',
  'invoice',
  'contact',
  'sOP',
  'cashFlowBudget',
  'gLAccount',
  'currencyRate',
  'taxObligation'
] as const;

// Whitelist of allowed column names per table
const ALLOWED_COLUMNS: Record<string, readonly string[]> = {
  bankAccount: ['id', 'xeroAccountId', 'name', 'code', 'status', 'currencyCode', 'createdAt', 'updatedAt'],
  bankTransaction: ['id', 'xeroTransactionId', 'amount', 'date', 'reference', 'type', 'status', 'isReconciled', 'createdAt', 'updatedAt'],
  invoice: ['id', 'xeroInvoiceId', 'invoiceNumber', 'status', 'total', 'dueDate', 'createdAt', 'updatedAt'],
  contact: ['id', 'xeroContactId', 'name', 'email', 'isSupplier', 'isCustomer', 'createdAt', 'updatedAt'],
  sOP: ['id', 'year', 'chartOfAccount', 'serviceType', 'status', 'createdAt', 'updatedAt'],
  cashFlowBudget: ['id', 'accountCode', 'accountName', 'category', 'monthYear', 'budgetedAmount', 'actualAmount'],
  gLAccount: ['id', 'code', 'name', 'type', 'class', 'status', 'description'],
  currencyRate: ['id', 'fromCurrency', 'toCurrency', 'rate', 'source', 'updatedAt'],
  taxObligation: ['id', 'type', 'dueDate', 'amount', 'status', 'periodStart', 'periodEnd']
};

// Schema for validating table names
export const tableNameSchema = z.enum(ALLOWED_TABLES);

// Schema for validating column names
export const columnNameSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid column name');

// Schema for order direction
export const orderDirectionSchema = z.enum(['asc', 'desc', 'ASC', 'DESC']);

export type AllowedTable = z.infer<typeof tableNameSchema>;
export type OrderDirection = z.infer<typeof orderDirectionSchema>;

/**
 * Validates table name against whitelist
 */
export function validateTableName(tableName: string): AllowedTable {
  return tableNameSchema.parse(tableName);
}

/**
 * Validates column name for a specific table
 */
export function validateColumnName(tableName: AllowedTable, columnName: string): string {
  const allowedColumns = ALLOWED_COLUMNS[tableName];
  if (!allowedColumns) {
    throw new Error(`No columns defined for table: ${tableName}`);
  }
  
  if (!allowedColumns.includes(columnName)) {
    throw new Error(`Column '${columnName}' is not allowed for table '${tableName}'`);
  }
  
  return columnNameSchema.parse(columnName);
}

/**
 * Safely builds an ORDER BY clause
 */
export function buildOrderBy(
  tableName: AllowedTable,
  columnName: string,
  direction: string = 'asc'
): Prisma.Sql {
  const validColumn = validateColumnName(tableName, columnName);
  const validDirection = orderDirectionSchema.parse(direction);
  
  // Use Prisma's safe SQL template
  return Prisma.sql`${Prisma.raw(validColumn)} ${Prisma.raw(validDirection.toUpperCase())}`;
}

/**
 * Safely builds a WHERE clause for searching
 */
export function buildSearchWhere(
  tableName: AllowedTable,
  searchColumns: string[],
  searchTerm: string
): Prisma.Sql {
  if (!searchTerm || searchTerm.trim() === '') {
    return Prisma.sql`1=1`; // Always true condition
  }
  
  const validColumns = searchColumns.map(col => validateColumnName(tableName, col));
  const searchPattern = `%${searchTerm}%`;
  
  // Build OR conditions for each column
  const conditions = validColumns.map((col, index) => {
    if (index === 0) {
      return Prisma.sql`${Prisma.raw(col)} LIKE ${searchPattern}`;
    }
    return Prisma.sql` OR ${Prisma.raw(col)} LIKE ${searchPattern}`;
  });
  
  return Prisma.sql`(${Prisma.join(conditions)})`;
}

/**
 * Safely builds a date range WHERE clause
 */
export function buildDateRangeWhere(
  tableName: AllowedTable,
  dateColumn: string,
  startDate?: Date,
  endDate?: Date
): Prisma.Sql | null {
  if (!startDate && !endDate) {
    return null;
  }
  
  const validColumn = validateColumnName(tableName, dateColumn);
  
  if (startDate && endDate) {
    return Prisma.sql`${Prisma.raw(validColumn)} BETWEEN ${startDate} AND ${endDate}`;
  } else if (startDate) {
    return Prisma.sql`${Prisma.raw(validColumn)} >= ${startDate}`;
  } else if (endDate) {
    return Prisma.sql`${Prisma.raw(validColumn)} <= ${endDate}`;
  }
  
  return null;
}

/**
 * Sanitizes a value for safe use in queries
 */
export function sanitizeValue(value: any): any {
  if (typeof value === 'string') {
    // Remove any SQL special characters
    return value.replace(/[;'"\\]/g, '');
  }
  return value;
}

/**
 * Builds a safe pagination clause
 */
export function buildPagination(page: number, limit: number): { skip: number; take: number } {
  // Ensure positive integers
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(1000, Math.max(1, Math.floor(limit))); // Cap at 1000
  
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit
  };
}

/**
 * Example usage for building a safe dynamic query
 */
export function buildSafeQuery(params: {
  tableName: string;
  searchTerm?: string;
  searchColumns?: string[];
  orderBy?: string;
  orderDirection?: string;
  startDate?: Date;
  endDate?: Date;
  dateColumn?: string;
  page?: number;
  limit?: number;
}) {
  // Validate table name
  const table = validateTableName(params.tableName);
  
  // Build WHERE conditions
  const conditions: Prisma.Sql[] = [];
  
  // Add search condition
  if (params.searchTerm && params.searchColumns) {
    conditions.push(buildSearchWhere(table, params.searchColumns, params.searchTerm));
  }
  
  // Add date range condition
  if (params.dateColumn && (params.startDate || params.endDate)) {
    const dateCondition = buildDateRangeWhere(table, params.dateColumn, params.startDate, params.endDate);
    if (dateCondition) {
      conditions.push(dateCondition);
    }
  }
  
  // Build ORDER BY
  let orderByClause: Prisma.Sql | undefined;
  if (params.orderBy) {
    orderByClause = buildOrderBy(table, params.orderBy, params.orderDirection);
  }
  
  // Build pagination
  const pagination = buildPagination(params.page || 1, params.limit || 20);
  
  return {
    table,
    whereClause: conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : null,
    orderByClause,
    pagination
  };
}

/**
 * Helper to validate and sanitize filter objects
 */
export function sanitizeFilters(filters: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(filters)) {
    // Validate key format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      continue; // Skip invalid keys
    }
    
    // Sanitize value
    if (Array.isArray(value)) {
      sanitized[key] = value.map(v => sanitizeValue(v));
    } else {
      sanitized[key] = sanitizeValue(value);
    }
  }
  
  return sanitized;
}
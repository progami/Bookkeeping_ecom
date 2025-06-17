import { describe, it, expect } from 'vitest';
import { xeroSyncSchema } from '@/lib/validation/schemas';

describe('Xero Sync Schema Validation', () => {
  it('should validate selective sync options', () => {
    const validInput = {
      forceSync: false,
      syncOptions: {
        entities: ['accounts', 'transactions', 'invoices'],
        fromDate: '2024-01-01T00:00:00Z',
        toDate: '2024-12-31T23:59:59Z',
        accountIds: ['acc-123', 'acc-456'],
        limits: {
          transactions: 5000,
          invoices: 1000,
          bills: 500,
        },
      },
    };

    const result = xeroSyncSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.syncOptions?.entities).toEqual(['accounts', 'transactions', 'invoices']);
      expect(result.data.syncOptions?.fromDate).toBe('2024-01-01T00:00:00Z');
      expect(result.data.syncOptions?.limits?.transactions).toBe(5000);
    }
  });

  it('should accept partial sync options', () => {
    const partialInput = {
      syncOptions: {
        entities: ['transactions'],
        fromDate: '2024-06-01T00:00:00Z',
      },
    };

    const result = xeroSyncSchema.safeParse(partialInput);
    expect(result.success).toBe(true);
  });

  it('should accept empty sync options', () => {
    const emptyInput = {};

    const result = xeroSyncSchema.safeParse(emptyInput);
    expect(result.success).toBe(true);
  });

  it('should validate entity types', () => {
    const invalidInput = {
      syncOptions: {
        entities: ['accounts', 'invalid-entity'],
      },
    };

    const result = xeroSyncSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should validate date formats', () => {
    const invalidDateInput = {
      syncOptions: {
        fromDate: '2024-01-01', // Missing time component
      },
    };

    const result = xeroSyncSchema.safeParse(invalidDateInput);
    expect(result.success).toBe(false);
  });

  it('should validate limit ranges', () => {
    const invalidLimitInput = {
      syncOptions: {
        limits: {
          transactions: -1, // Negative value
        },
      },
    };

    const result = xeroSyncSchema.safeParse(invalidLimitInput);
    expect(result.success).toBe(false);
  });
});
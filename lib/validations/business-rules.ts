import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { structuredLogger } from '@/lib/logger';

// Transaction validation rules
export const transactionValidationRules = {
  // Amount validation
  amount: z.number()
    .positive('Transaction amount must be positive')
    .max(10000000, 'Transaction amount exceeds maximum limit of 10,000,000'),

  // Date validation - transactions cannot be future dated or too old
  date: z.date()
    .max(new Date(), 'Transaction date cannot be in the future')
    .min(new Date('2020-01-01'), 'Transaction date is too old (before 2020)'),

  // Reference validation
  reference: z.string()
    .max(255, 'Reference must not exceed 255 characters')
    .optional(),

  // Bank account validation
  bankAccountId: z.string()
    .min(1, 'Bank account is required')
};

// Invoice validation rules
export const invoiceValidationRules = {
  // Invoice amount limits
  total: z.number()
    .min(0, 'Invoice total cannot be negative')
    .max(1000000, 'Invoice total exceeds maximum limit of 1,000,000'),

  // Due date must be after invoice date
  validateDates: (invoiceDate: Date, dueDate: Date | null) => {
    if (dueDate && dueDate < invoiceDate) {
      throw new Error('Due date must be after invoice date');
    }
  },

  // Invoice number format
  invoiceNumber: z.string()
    .regex(/^[A-Z0-9-]+$/, 'Invoice number must contain only uppercase letters, numbers, and hyphens')
    .max(50, 'Invoice number must not exceed 50 characters')
    .optional()
};

// Business logic validators
export class BusinessValidator {
  // Validate bank reconciliation rules
  static async validateReconciliation(transactionId: string): Promise<void> {
    const transaction = await prisma.bankTransaction.findUnique({
      where: { id: transactionId },
      include: { bankAccount: true }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Check if transaction is already reconciled
    if (transaction.isReconciled) {
      throw new Error('Transaction is already reconciled');
    }

    // Check if bank account is active
    if (transaction.bankAccount?.status !== 'ACTIVE') {
      throw new Error('Cannot reconcile transactions for inactive bank account');
    }

    // Check if transaction date is not too old
    const daysSinceTransaction = Math.floor(
      (Date.now() - transaction.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceTransaction > 180) {
      throw new Error('Cannot reconcile transactions older than 180 days');
    }
  }

  // Validate duplicate transactions
  static async checkDuplicateTransaction(
    bankAccountId: string,
    date: Date,
    amount: number,
    reference?: string
  ): Promise<boolean> {
    // Look for similar transactions within 2 days
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 2);

    const duplicates = await prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        date: {
          gte: startDate,
          lte: endDate
        },
        total: amount,
        reference: reference || undefined
      }
    });

    if (duplicates.length > 0) {
      structuredLogger.warn('Potential duplicate transaction detected', {
        component: 'business-validator',
        bankAccountId,
        date,
        amount,
        reference,
        duplicates: duplicates.map(d => d.id)
      });
      return true;
    }

    return false;
  }

  // Validate GL account usage
  static async validateGLAccount(accountCode: string, transactionType: string): Promise<void> {
    const account = await prisma.gLAccount.findUnique({
      where: { code: accountCode }
    });

    if (!account) {
      throw new Error(`GL Account ${accountCode} not found`);
    }

    if (account.status !== 'ACTIVE') {
      throw new Error(`GL Account ${accountCode} is not active`);
    }

    // Validate account type matches transaction type
    const validAccountTypes: Record<string, string[]> = {
      'SPEND': ['EXPENSE', 'ASSET', 'LIABILITY'],
      'RECEIVE': ['REVENUE', 'ASSET', 'LIABILITY']
    };

    if (!validAccountTypes[transactionType]?.includes(account.type)) {
      throw new Error(
        `GL Account type ${account.type} is not valid for ${transactionType} transactions`
      );
    }

    // Check if account can be used for payments
    if (transactionType === 'SPEND' && !account.enablePaymentsToAccount) {
      throw new Error(`GL Account ${accountCode} does not allow payments`);
    }
  }

  // Validate contact credit limits
  static async validateContactCreditLimit(
    contactId: string,
    amount: number
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { xeroContactId: contactId }
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Get outstanding invoices for this contact
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        contactId,
        status: { in: ['AUTHORISED', 'SUBMITTED'] },
        type: 'ACCREC',
        amountDue: { gt: 0 }
      },
      select: { amountDue: true }
    });

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountDue),
      0
    );

    // Default credit limit (could be stored per contact)
    const creditLimit = 50000;

    if (totalOutstanding + amount > creditLimit) {
      throw new Error(
        `Transaction would exceed credit limit. Outstanding: ${totalOutstanding}, Limit: ${creditLimit}`
      );
    }
  }

  // Validate tax calculations
  static validateTaxCalculation(
    subTotal: number,
    taxAmount: number,
    total: number,
    taxRate: number = 0.15 // Default 15% tax
  ): void {
    const expectedTax = Math.round(subTotal * taxRate * 100) / 100;
    const expectedTotal = subTotal + taxAmount;

    // Allow for small rounding differences (0.01)
    if (Math.abs(taxAmount - expectedTax) > 0.01) {
      throw new Error(
        `Tax calculation error. Expected tax: ${expectedTax}, Actual: ${taxAmount}`
      );
    }

    if (Math.abs(total - expectedTotal) > 0.01) {
      throw new Error(
        `Total calculation error. Expected: ${expectedTotal}, Actual: ${total}`
      );
    }
  }

  // Validate currency conversion
  static async validateCurrencyConversion(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rate: number
  ): Promise<void> {
    if (fromCurrency === toCurrency && rate !== 1) {
      throw new Error('Same currency conversion must have rate of 1');
    }

    // Get latest rate from database
    const latestRate = await prisma.currencyRate.findFirst({
      where: {
        fromCurrency,
        toCurrency
      },
      orderBy: { effectiveDate: 'desc' }
    });

    if (latestRate) {
      const rateDifference = Math.abs(Number(latestRate.rate) - rate) / Number(latestRate.rate);
      
      // Alert if rate differs by more than 10%
      if (rateDifference > 0.1) {
        structuredLogger.warn('Significant currency rate difference detected', {
          component: 'business-validator',
          fromCurrency,
          toCurrency,
          providedRate: rate,
          latestRate: Number(latestRate.rate),
          difference: `${(rateDifference * 100).toFixed(2)}%`
        });
      }
    }
  }

  // Validate period closing
  static async validatePeriodOpen(date: Date): Promise<void> {
    // Check if the period is closed (e.g., for month-end processing)
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // In production, this would check against a PeriodClose table
    // For now, we'll prevent changes to periods older than 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (date < threeMonthsAgo) {
      throw new Error(
        `Cannot modify transactions in closed period (${year}-${month + 1})`
      );
    }
  }

  // Validate SOP compliance
  static async validateSOPCompliance(
    transaction: any,
    accountCode: string
  ): Promise<void> {
    const year = new Date().getFullYear().toString();
    
    const sop = await prisma.standardOperatingProcedure.findFirst({
      where: {
        year,
        chartOfAccount: { contains: accountCode },
        isActive: true
      }
    });

    if (!sop) {
      return; // No SOP rules for this account
    }

    // Validate reference format
    if (sop.referenceTemplate && transaction.reference) {
      const referencePattern = sop.referenceTemplate
        .replace(/\[.*?\]/g, '.*'); // Simple pattern matching
      
      const regex = new RegExp(referencePattern);
      if (!regex.test(transaction.reference)) {
        structuredLogger.warn('Transaction reference does not match SOP template', {
          component: 'business-validator',
          accountCode,
          reference: transaction.reference,
          template: sop.referenceTemplate,
          example: sop.referenceExample
        });
      }
    }

    // Validate description format
    if (sop.descriptionTemplate && transaction.description) {
      const descriptionPattern = sop.descriptionTemplate
        .replace(/\[.*?\]/g, '.*');
      
      const regex = new RegExp(descriptionPattern);
      if (!regex.test(transaction.description)) {
        structuredLogger.warn('Transaction description does not match SOP template', {
          component: 'business-validator',
          accountCode,
          description: transaction.description,
          template: sop.descriptionTemplate,
          example: sop.descriptionExample
        });
      }
    }
  }
}

// Export validation schemas
export const transactionSchema = z.object({
  type: z.enum(['SPEND', 'RECEIVE']),
  bankAccountId: transactionValidationRules.bankAccountId,
  date: transactionValidationRules.date,
  amount: transactionValidationRules.amount,
  reference: transactionValidationRules.reference,
  contactId: z.string().optional(),
  accountCode: z.string().optional(),
  taxType: z.string().optional(),
  description: z.string().max(500).optional()
});

export const invoiceSchema = z.object({
  type: z.enum(['ACCREC', 'ACCPAY']),
  contactId: z.string().min(1, 'Contact is required'),
  date: z.date(),
  dueDate: z.date().optional(),
  invoiceNumber: invoiceValidationRules.invoiceNumber,
  reference: z.string().max(255).optional(),
  total: invoiceValidationRules.total,
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitAmount: z.number().min(0),
    accountCode: z.string(),
    taxType: z.string()
  })).min(1, 'At least one line item is required')
});
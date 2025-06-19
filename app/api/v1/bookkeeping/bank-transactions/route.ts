import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { bankTransactionQuerySchema } from '@/lib/validation/schemas';
import { Logger } from '@/lib/logger';
import { apiWrapper } from '@/lib/errors/api-error-wrapper';

const logger = new Logger({ module: 'bank-transactions-api' });

export const dynamic = 'force-dynamic';

export const GET = withValidation(
  { querySchema: bankTransactionQuerySchema },
  async (request, { query }) => {
    return apiWrapper(async () => {
      const page = query?.page || 1;
      // Enforce a maximum page size to prevent memory issues
      const requestedPageSize = query?.limit || 50;
      const pageSize = Math.min(requestedPageSize, 500); // Max 500 records per page
      const skip = (page - 1) * pageSize;
      
      logger.info(`Fetching bank transactions - page: ${page}, pageSize: ${pageSize}`);

      // Fetch GL accounts and bank accounts for lookup (these are small tables)
      const [glAccounts, bankAccounts] = await Promise.all([
        prisma.gLAccount.findMany({
          select: { code: true, name: true }
        }),
        prisma.bankAccount.findMany({
          select: { id: true, name: true, code: true }
        })
      ]);

      // Create lookup maps for efficient access
      const glAccountMap = new Map(glAccounts.map(acc => [acc.code, acc]));
      const bankAccountMap = new Map(bankAccounts.map(acc => [acc.id, acc]));

      // Get total count for pagination
      const total = await prisma.bankTransaction.count();

      // Fetch paginated transactions with optimized query
      const transactions = await prisma.bankTransaction.findMany({
        skip,
        take: pageSize,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          xeroTransactionId: true,
          bankAccountId: true,
          date: true,
          type: true,
          status: true,
          isReconciled: true,
          reference: true,
          description: true,
          contactName: true,
          currencyCode: true,
          total: true,
          accountCode: true,
          hasAttachments: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
          // Only select necessary fields from related bankAccount
          bankAccount: {
            select: {
              name: true,
              code: true
            }
          }
        }
      });

      const totalPages = Math.ceil(total / pageSize);

      logger.info(`Fetched ${transactions.length} transactions, total: ${total}, pages: ${totalPages}`);

      return NextResponse.json({
        transactions,
        total,
        page,
        pageSize,
        totalPages
      });
    });
  }
)
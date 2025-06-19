import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiWrapper, ApiErrors, successResponse } from '@/lib/errors/api-error-wrapper';
import { structuredLogger } from '@/lib/logger';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { accountsQuerySchema } from '@/lib/validation/schemas';

export const GET = apiWrapper(
  async (request, { session }) => {
    structuredLogger.info('Fetching bank accounts', {
      component: 'xero-accounts',
      userId: session?.user?.userId
    });
    // Get bank accounts from database
    const dbAccounts = await prisma.bankAccount.findMany({
        include: {
          _count: {
            select: {
              transactions: {
                where: {
                  isReconciled: false
                }
              }
            }
          },
          transactions: {
            where: {
              status: { not: 'DELETED' }
            },
            select: {
              amount: true,
              type: true
            }
          }
        }
      });

    // Get total unreconciled count
    const totalUnreconciled = await prisma.bankTransaction.count({
        where: {
          isReconciled: false
        }
      });

    // Transform accounts data and calculate balances from transactions
    const accounts = dbAccounts.map(account => {
        // Calculate balance from transactions
        const balance = account.transactions.reduce((sum, tx) => {
          const amount = tx.amount ? (typeof tx.amount === 'number' ? tx.amount : tx.amount.toNumber()) : 0;
          // RECEIVE is positive, SPEND is negative
          return sum + (tx.type === 'RECEIVE' ? amount : -Math.abs(amount));
        }, 0);

        return {
          id: account.id,
          xeroAccountId: account.xeroAccountId,
          name: account.name,
          code: account.code,
          currencyCode: account.currencyCode || 'GBP',
          balance: balance,
          status: account.status,
          bankName: account.bankName,
          accountNumber: account.accountNumber,
          unreconciledTransactions: account._count.transactions,
          lastSynced: account.updatedAt
        };
      });

    // Calculate reconciliation rate
    const totalTransactions = await prisma.bankTransaction.count();
    const reconciliationRate = totalTransactions > 0 
      ? Math.round(((totalTransactions - totalUnreconciled) / totalTransactions) * 100)
      : 100;

    structuredLogger.info('Accounts fetched successfully', {
      component: 'xero-accounts',
      accountCount: accounts.length,
      totalUnreconciled,
      reconciliationRate
    });

    return successResponse({
      accounts,
      totalUnreconciled,
      reconciliationRate,
      source: 'database' // Indicate data is from local database
    });
  },
  {
    authLevel: ValidationLevel.XERO,
    endpoint: '/api/v1/xero/accounts'
  }
);
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withValidation } from '@/lib/validation/middleware';
import { bankTransactionQuerySchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = withValidation(
  { querySchema: bankTransactionQuerySchema },
  async (request, { query }) => {
    try {
      const page = query?.page || 1;
      const pageSize = query?.pageSize || 50;
      const skip = (page - 1) * pageSize;

    // Get total count
    const total = await prisma.bankTransaction.count();

    // Get transactions with bank account details
    const transactions = await prisma.bankTransaction.findMany({
      skip,
      take: pageSize,
      orderBy: { date: 'desc' },
      include: {
        bankAccount: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    const totalPages = Math.ceil(total / pageSize);

      return NextResponse.json({
        transactions,
        total,
        page,
        pageSize,
        totalPages
      });
    } catch (error: any) {
      console.error('Error fetching bank transactions:', error);
      return NextResponse.json({
        error: 'Failed to fetch bank transactions',
        message: error.message
      }, { status: 500 });
    }
  }
)
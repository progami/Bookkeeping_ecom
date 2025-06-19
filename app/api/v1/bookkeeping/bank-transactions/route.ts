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
      const pageSize = query?.limit || 50;
      const showAll = !query?.limit;
      const skip = showAll ? 0 : (page - 1) * pageSize;
      
      console.log('Bank transactions API - page:', page, 'limit:', query?.limit, 'pageSize:', pageSize, 'skip:', skip, 'showAll:', showAll);

    // Get total count
    const total = await prisma.bankTransaction.count();

    // Get transactions with bank account details
    const findManyOptions: any = {
      skip,
      orderBy: { date: 'desc' },
      include: {
        bankAccount: {
          select: {
            name: true,
            code: true
          }
        }
      }
    };
    
    // Only add take (limit) if not showing all
    if (!showAll) {
      findManyOptions.take = pageSize;
    }
    
    const transactions = await prisma.bankTransaction.findMany(findManyOptions);

    const totalPages = showAll ? 1 : Math.ceil(total / pageSize);

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
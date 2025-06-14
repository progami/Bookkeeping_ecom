import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
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
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { tableName: string } }
) {
  try {
    const { tableName } = params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let records: any[] = [];
    let total = 0;

    // Fetch data based on table name
    switch (tableName) {
      case 'GLAccount':
        [records, total] = await Promise.all([
          prisma.gLAccount.findMany({
            take: limit,
            skip: offset,
            orderBy: { code: 'asc' }
          }),
          prisma.gLAccount.count()
        ]);
        break;

      case 'BankAccount':
        [records, total] = await Promise.all([
          prisma.bankAccount.findMany({
            take: limit,
            skip: offset,
            orderBy: { name: 'asc' }
          }),
          prisma.bankAccount.count()
        ]);
        break;

      case 'BankTransaction':
        [records, total] = await Promise.all([
          prisma.bankTransaction.findMany({
            take: limit,
            skip: offset,
            orderBy: { date: 'desc' },
            include: {
              bankAccount: {
                select: {
                  name: true
                }
              }
            }
          }),
          prisma.bankTransaction.count()
        ]);
        break;

      case 'SyncLog':
        [records, total] = await Promise.all([
          prisma.syncLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { startedAt: 'desc' }
          }),
          prisma.syncLog.count()
        ]);
        break;

      case 'StandardOperatingProcedure':
        [records, total] = await Promise.all([
          prisma.standardOperatingProcedure.findMany({
            take: limit,
            skip: offset,
            orderBy: [{ year: 'desc' }, { chartOfAccount: 'asc' }]
          }),
          prisma.standardOperatingProcedure.count()
        ]);
        break;

      case 'SyncedInvoice':
        [records, total] = await Promise.all([
          prisma.syncedInvoice.findMany({
            take: limit,
            skip: offset,
            orderBy: { dueDate: 'desc' }
          }),
          prisma.syncedInvoice.count()
        ]);
        break;

      case 'RepeatingTransaction':
        [records, total] = await Promise.all([
          prisma.repeatingTransaction.findMany({
            take: limit,
            skip: offset,
            orderBy: { nextScheduledDate: 'asc' }
          }),
          prisma.repeatingTransaction.count()
        ]);
        break;

      case 'CashFlowBudget':
        [records, total] = await Promise.all([
          prisma.cashFlowBudget.findMany({
            take: limit,
            skip: offset,
            orderBy: [{ monthYear: 'desc' }, { accountCode: 'asc' }]
          }),
          prisma.cashFlowBudget.count()
        ]);
        break;

      case 'CashFlowForecast':
        [records, total] = await Promise.all([
          prisma.cashFlowForecast.findMany({
            take: limit,
            skip: offset,
            orderBy: { date: 'asc' }
          }),
          prisma.cashFlowForecast.count()
        ]);
        break;

      case 'PaymentPattern':
        [records, total] = await Promise.all([
          prisma.paymentPattern.findMany({
            take: limit,
            skip: offset,
            orderBy: { contactName: 'asc' }
          }),
          prisma.paymentPattern.count()
        ]);
        break;

      case 'TaxObligation':
        [records, total] = await Promise.all([
          prisma.taxObligation.findMany({
            take: limit,
            skip: offset,
            orderBy: { dueDate: 'asc' }
          }),
          prisma.taxObligation.count()
        ]);
        break;

      case 'CashFlowSyncLog':
        [records, total] = await Promise.all([
          prisma.cashFlowSyncLog.findMany({
            take: limit,
            skip: offset,
            orderBy: { startedAt: 'desc' }
          }),
          prisma.cashFlowSyncLog.count()
        ]);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid table name'
        }, { status: 400 });
    }

    return NextResponse.json({
      records,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (error: any) {
    console.error(`Error fetching ${params.tableName} data:`, error);
    return NextResponse.json({
      error: 'Failed to fetch table data',
      message: error.message
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { BudgetImportExport } from '@/lib/budget-import-export';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startMonth = searchParams.get('startMonth') || 
      new Date().toISOString().substring(0, 7);
    const endMonth = searchParams.get('endMonth') || 
      new Date(new Date().setMonth(new Date().getMonth() + 11))
        .toISOString().substring(0, 7);

    const exporter = new BudgetImportExport();
    const buffer = await exporter.exportBudgets(startMonth, endMonth);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="budget-export-${startMonth}-to-${endMonth}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Budget export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    );
  }
}
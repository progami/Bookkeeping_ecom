import { NextRequest, NextResponse } from 'next/server';
import { BudgetImportExport } from '@/lib/budget-import-export';

export async function GET(request: NextRequest) {
  try {
    const exporter = new BudgetImportExport();
    const buffer = await exporter.generateBudgetTemplate();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="budget-template.xlsx"',
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Template generation failed' },
      { status: 500 }
    );
  }
}
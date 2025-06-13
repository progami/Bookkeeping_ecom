import { NextRequest, NextResponse } from 'next/server';
import { BudgetImportExport } from '@/lib/budget-import-export';
import formidable from 'formidable';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type');
    
    if (!contentType?.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'File upload required' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const importType = formData.get('type') as string || 'manual';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Import budgets
    const importer = new BudgetImportExport();
    let result;

    if (importType === 'xero') {
      result = await importer.importXeroBudgetExport(buffer);
    } else {
      result = await importer.importBudgets(buffer, file.name);
    }

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      errors: result.errors,
      message: result.success 
        ? `Successfully imported ${result.imported} budget entries`
        : 'Import completed with errors',
    });
  } catch (error) {
    console.error('Budget import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
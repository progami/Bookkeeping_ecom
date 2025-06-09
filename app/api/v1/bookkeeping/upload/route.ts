import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read file content
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Look for sheets named '2024' or '2025'
    const targetSheets = ['2024', '2025'];
    let rules: any[] = [];
    
    for (const sheetName of targetSheets) {
      if (workbook.SheetNames.includes(sheetName)) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Parse the Excel data based on expected columns
        const sheetRules = jsonData.map((row: any) => {
          // Map Excel columns to our rule structure
          // Adjust these based on actual Excel structure
          return {
            pattern: row['Pattern'] || row['Search Pattern'] || row['Description Pattern'] || '',
            reference: row['Reference'] || row['Ref'] || '',
            description: row['Description'] || row['Desc'] || '',
            category: row['Category'] || row['Account Code'] || row['Account'] || '',
            taxType: row['Tax Type'] || row['Tax'] || 'GST',
            active: row['Active'] !== 'N' && row['Active'] !== false,
          };
        }).filter(rule => rule.pattern); // Only include rules with patterns
        
        rules = [...rules, ...sheetRules];
      }
    }
    
    if (rules.length === 0) {
      return NextResponse.json(
        { error: 'No valid rules found in Excel file' },
        { status: 400 }
      );
    }
    
    // Import rules to database
    let importedCount = 0;
    let skippedCount = 0;
    
    for (const rule of rules) {
      try {
        // Check if rule already exists
        const existing = await prisma.categorizationRule.findFirst({
          where: {
            matchValue: rule.pattern,
            accountCode: rule.category
          }
        });
        
        if (existing) {
          skippedCount++;
          continue;
        }
        
        // Create new rule
        await prisma.categorizationRule.create({
          data: {
            name: rule.description || `Rule for ${rule.pattern}`,
            description: rule.description,
            matchType: 'contains',
            matchField: 'description',
            matchValue: rule.pattern,
            accountCode: rule.category,
            taxType: rule.taxType,
            priority: 0,
            isActive: rule.active
          }
        });
        
        importedCount++;
      } catch (error) {
        console.error('Error importing rule:', error);
      }
    }
    
    return NextResponse.json({
      success: true,
      count: importedCount,
      skipped: skippedCount,
      total: rules.length
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    );
  }
}
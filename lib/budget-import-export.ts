import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';

interface BudgetRow {
  accountCode: string;
  accountName: string;
  category: string;
  monthYear: string;
  budgetedAmount: number;
  notes?: string;
}

export class BudgetImportExport {
  // Export budgets to Excel format
  async exportBudgets(startMonth: string, endMonth: string): Promise<Buffer> {
    const budgets = await prisma.cashFlowBudget.findMany({
      where: {
        monthYear: {
          gte: startMonth,
          lte: endMonth,
        },
      },
      orderBy: [
        { monthYear: 'asc' },
        { accountCode: 'asc' },
      ],
    });

    // Transform data for Excel
    const data = budgets.map(budget => ({
      'Account Code': budget.accountCode,
      'Account Name': budget.accountName,
      'Category': budget.category,
      'Month': budget.monthYear,
      'Budgeted Amount': budget.budgetedAmount,
      'Actual Amount': budget.actualAmount,
      'Variance': budget.variance,
      'Notes': budget.notes || '',
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = [
      { wch: 15 }, // Account Code
      { wch: 30 }, // Account Name
      { wch: 15 }, // Category
      { wch: 10 }, // Month
      { wch: 15 }, // Budgeted Amount
      { wch: 15 }, // Actual Amount
      { wch: 15 }, // Variance
      { wch: 30 }, // Notes
    ];
    ws['!cols'] = colWidths;

    // Add to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Budget');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
  }

  // Import budgets from Excel/CSV
  async importBudgets(fileBuffer: Buffer, fileName: string): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      // Read workbook
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

      // Validate and import each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel rows start at 1, plus header

        try {
          const budgetRow = this.validateBudgetRow(row, rowNumber);
          
          // Upsert budget record
          await prisma.cashFlowBudget.upsert({
            where: {
              accountCode_monthYear: {
                accountCode: budgetRow.accountCode,
                monthYear: budgetRow.monthYear,
              },
            },
            create: {
              ...budgetRow,
              importedFrom: 'manual_import',
            },
            update: {
              budgetedAmount: budgetRow.budgetedAmount,
              notes: budgetRow.notes,
              updatedAt: new Date(),
            },
          });

          imported++;
        } catch (error) {
          errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        success: errors.length === 0,
        imported,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`File parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // Import from Xero Budget Manager export
  async importXeroBudgetExport(fileBuffer: Buffer): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      // Xero exports have a specific format
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get raw data including headers
      const rawData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      // Find header row (usually contains "Account", "Jan", "Feb", etc.)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i] as any[];
        if (row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('account'))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error('Could not find header row in Xero export');
      }

      const headers = rawData[headerRowIndex] as string[];
      const accountIndex = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes('account')
      );

      // Process data rows
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        if (!row[accountIndex]) continue; // Skip empty rows

        const accountInfo = this.parseXeroAccountInfo(row[accountIndex]);
        if (!accountInfo) continue;

        // Process each month column
        for (let j = accountIndex + 1; j < headers.length; j++) {
          const monthHeader = headers[j];
          if (!monthHeader || typeof monthHeader !== 'string') continue;

          const monthYear = this.parseXeroMonthHeader(monthHeader);
          if (!monthYear) continue;

          const amount = parseFloat(row[j]) || 0;
          if (amount === 0) continue;

          try {
            await prisma.cashFlowBudget.upsert({
              where: {
                accountCode_monthYear: {
                  accountCode: accountInfo.code,
                  monthYear,
                },
              },
              create: {
                accountCode: accountInfo.code,
                accountName: accountInfo.name,
                category: this.determineCategory(accountInfo.code),
                monthYear,
                budgetedAmount: Math.abs(amount),
                importedFrom: 'xero_export',
              },
              update: {
                budgetedAmount: Math.abs(amount),
                updatedAt: new Date(),
              },
            });

            imported++;
          } catch (error) {
            errors.push(
              `Account ${accountInfo.code}, Month ${monthYear}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
          }
        }
      }

      return {
        success: errors.length === 0,
        imported,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`Xero import error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  // Generate budget template
  async generateBudgetTemplate(): Promise<Buffer> {
    // Get GL accounts for template
    const accounts = await prisma.gLAccount.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { type: 'REVENUE' },
          { type: 'EXPENSE' },
        ],
      },
      orderBy: { code: 'asc' },
    });

    // Generate 12 months of templates
    const data: any[] = [];
    const startDate = new Date();

    for (let month = 0; month < 12; month++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth() + month, 1);
      const monthYear = format(date, 'yyyy-MM');

      for (const account of accounts) {
        data.push({
          'Account Code': account.code,
          'Account Name': account.name,
          'Category': account.type,
          'Month': monthYear,
          'Budgeted Amount': 0,
          'Notes': '',
        });
      }
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Style and formatting
    const colWidths = [
      { wch: 15 }, // Account Code
      { wch: 40 }, // Account Name
      { wch: 15 }, // Category
      { wch: 10 }, // Month
      { wch: 15 }, // Budgeted Amount
      { wch: 50 }, // Notes
    ];
    ws['!cols'] = colWidths;

    // Add instructions sheet
    const instructions = [
      ['Budget Import Template Instructions'],
      [''],
      ['1. Fill in the Budgeted Amount column for each account and month'],
      ['2. Categories should be one of: REVENUE, EXPENSE, TAX'],
      ['3. Month format should be YYYY-MM (e.g., 2024-01)'],
      ['4. Save as Excel (.xlsx) or CSV file'],
      ['5. Import using the Budget Import feature'],
      [''],
      ['Tips:'],
      ['- Leave amount as 0 for accounts with no budget'],
      ['- Use negative amounts for revenue (money in)'],
      ['- Use positive amounts for expenses (money out)'],
      ['- Add notes for any special considerations'],
    ];

    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');
    XLSX.utils.book_append_sheet(wb, ws, 'Budget Template');

    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
  }

  // Validate budget row
  private validateBudgetRow(row: any, rowNumber: number): BudgetRow {
    const accountCode = String(row['Account Code'] || '').trim();
    const accountName = String(row['Account Name'] || '').trim();
    const category = String(row['Category'] || '').trim().toUpperCase();
    const monthYear = String(row['Month'] || '').trim();
    const budgetedAmount = parseFloat(row['Budgeted Amount']) || 0;
    const notes = String(row['Notes'] || '').trim();

    // Validations
    if (!accountCode) {
      throw new Error('Account Code is required');
    }

    if (!accountName) {
      throw new Error('Account Name is required');
    }

    if (!['REVENUE', 'EXPENSE', 'TAX'].includes(category)) {
      throw new Error(`Invalid category: ${category}. Must be REVENUE, EXPENSE, or TAX`);
    }

    if (!monthYear.match(/^\d{4}-\d{2}$/)) {
      throw new Error(`Invalid month format: ${monthYear}. Use YYYY-MM format`);
    }

    return {
      accountCode,
      accountName,
      category,
      monthYear,
      budgetedAmount: Math.abs(budgetedAmount),
      notes: notes || undefined,
    };
  }

  // Parse Xero account info from cell
  private parseXeroAccountInfo(cellValue: any): { code: string; name: string } | null {
    const str = String(cellValue).trim();
    
    // Format: "200 - Sales" or "200 Sales"
    const match = str.match(/^(\d+)\s*[-–]\s*(.+)$/) || str.match(/^(\d+)\s+(.+)$/);
    
    if (match) {
      return {
        code: match[1],
        name: match[2].trim(),
      };
    }

    return null;
  }

  // Parse Xero month header
  private parseXeroMonthHeader(header: string): string | null {
    // Common formats: "Jan-24", "Jan 2024", "January 2024", "01/2024"
    const str = header.trim();
    
    // Try different date formats
    const formats = [
      { pattern: /^(\w{3})-(\d{2})$/, parser: (m: RegExpMatchArray) => {
        const year = 2000 + parseInt(m[2]);
        const month = this.getMonthNumber(m[1]);
        return month ? `${year}-${month.toString().padStart(2, '0')}` : null;
      }},
      { pattern: /^(\w{3})\s+(\d{4})$/, parser: (m: RegExpMatchArray) => {
        const month = this.getMonthNumber(m[1]);
        return month ? `${m[2]}-${month.toString().padStart(2, '0')}` : null;
      }},
      { pattern: /^(\d{1,2})\/(\d{4})$/, parser: (m: RegExpMatchArray) => {
        return `${m[2]}-${m[1].padStart(2, '0')}`;
      }},
    ];

    for (const { pattern, parser } of formats) {
      const match = str.match(pattern);
      if (match) {
        return parser(match);
      }
    }

    return null;
  }

  // Get month number from name
  private getMonthNumber(monthName: string): number | null {
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const key = monthName.toLowerCase().substring(0, 3);
    return months[key] || null;
  }

  // Determine category from account code
  private determineCategory(accountCode: string): string {
    const code = parseInt(accountCode);
    
    if (code >= 200 && code < 300) return 'REVENUE';
    if (code >= 300 && code < 400) return 'EXPENSE';
    if (code >= 400 && code < 500) return 'EXPENSE';
    if (code >= 800 && code < 900) return 'TAX';
    
    return 'EXPENSE'; // Default
  }
}
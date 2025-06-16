import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { FinancialCalc } from '@/lib/financial-calculations';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';

// Validation schema for financial summary query
const financialSummaryQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'year']).optional().default('30d')
});

export const GET = withValidation(
  { querySchema: financialSummaryQuerySchema },
  async (request, { query }) => {
    const startTime = Date.now();
    try {
    // Get Xero client via OAuth
    const xeroClient = await getXeroClient();
    
    if (!xeroClient) {
      return NextResponse.json({
        error: 'Not connected to Xero',
        details: 'Please connect your Xero account first'
      }, { status: 401 });
    }

    // Get the tenant ID from connected tenants
    const tenants = await xeroClient.updateTenants();
    
    if (!tenants || tenants.length === 0) {
      return NextResponse.json({
        error: 'No Xero tenants found',
        details: 'Please reconnect to Xero'
      }, { status: 401 });
    }

    const tenantId = tenants[0].tenantId;
    
    // Use validated query parameter
    const period = query?.period || '30d';
    
    // Calculate date range based on period
    const today = new Date();
    const startDate = new Date();
    
    switch(period) {
      case '7d':
        startDate.setDate(today.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(today.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(today.getDate() - 90);
        break;
      default:
        startDate.setDate(today.getDate() - 30);
    }
    
    // Format dates for Xero API
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];
    
    console.log('Fetching financial data from Xero...');
    
    // Fetch current Balance Sheet, historical Balance Sheet, and P&L Report in parallel
    const [currentBalanceSheet, historicalBalanceSheet, profitLossResponse] = await Promise.all([
      xeroClient.accountingApi.getReportBalanceSheet(
        tenantId,
        toDate
      ),
      xeroClient.accountingApi.getReportBalanceSheet(
        tenantId,
        fromDate
      ),
      xeroClient.accountingApi.getReportProfitAndLoss(
        tenantId,
        fromDate,
        toDate
      )
    ]);
    
    // Helper function to recursively find values in report rows
    const findValueInRows = (rows: any[], searchTerms: string[]): string => {
      for (const row of rows) {
        if (row.cells && row.cells.length > 0) {
          const label = (row.cells[0]?.value || '').toLowerCase();
          const isMatch = searchTerms.some(term => label.includes(term.toLowerCase()));
          
          if (isMatch) {
            // Try to find value in cells (usually in cell[1] for reports)
            for (let i = 1; i < row.cells.length; i++) {
              const value = row.cells[i]?.value || '0';
              const decimal = FinancialCalc.decimal(value);
              if (!decimal.isZero()) {
                return value;
              }
            }
          }
        }
        
        // Recursively search in nested rows
        if (row.rows && row.rows.length > 0) {
          const nestedValue = findValueInRows(row.rows, searchTerms);
          if (nestedValue !== '0') {
            return nestedValue;
          }
        }
      }
      return '0';
    };
    
    // Helper function to extract balance sheet values
    const extractBalanceSheetValues = (balanceSheet: any) => {
      let totalAssets = FinancialCalc.decimal(0);
      let totalLiabilities = FinancialCalc.decimal(0);
      let netAssets = FinancialCalc.decimal(0);
      let cashInBank = FinancialCalc.decimal(0);
      
      if (balanceSheet.body?.reports?.[0]?.rows) {
        const rows = balanceSheet.body.reports[0].rows;
        
        rows.forEach((row: any) => {
          // Find Bank section for cash in bank
          if (row.rowType === 'Section' && row.title === 'Bank' && row.rows) {
            row.rows.forEach((bankRow: any) => {
              if (bankRow.rowType === 'SummaryRow' && bankRow.cells?.[0]?.value === 'Total Bank') {
                cashInBank = FinancialCalc.decimal(bankRow.cells[1]?.value || '0');
              }
            });
          }
          // Find summary rows for totals
          else if (row.rowType === 'Section' && row.title === '' && row.rows) {
            row.rows.forEach((summaryRow: any) => {
              if (summaryRow.rowType === 'SummaryRow' && summaryRow.cells?.[0]?.value === 'Total Assets') {
                totalAssets = FinancialCalc.decimal(summaryRow.cells[1]?.value || '0');
              } else if (summaryRow.rowType === 'SummaryRow' && summaryRow.cells?.[0]?.value === 'Total Liabilities') {
                totalLiabilities = FinancialCalc.decimal(summaryRow.cells[1]?.value || '0');
              } else if (summaryRow.rowType === 'Row' && summaryRow.cells?.[0]?.value === 'Net Assets') {
                netAssets = FinancialCalc.decimal(summaryRow.cells[1]?.value || '0');
              }
            });
          }
        });
        
        // Calculate net assets if not found
        if (netAssets.isZero() && (!totalAssets.isZero() || !totalLiabilities.isZero())) {
          netAssets = totalAssets.minus(totalLiabilities);
        }
      }
      
      return { 
        totalAssets: FinancialCalc.toNumber(totalAssets), 
        totalLiabilities: FinancialCalc.toNumber(totalLiabilities), 
        netAssets: FinancialCalc.toNumber(netAssets), 
        cashInBank: FinancialCalc.toNumber(cashInBank) 
      };
    };
    
    // Process current and historical balance sheets
    const currentBS = extractBalanceSheetValues(currentBalanceSheet);
    const historicalBS = extractBalanceSheetValues(historicalBalanceSheet);
    
    // Process P&L Report  
    let totalIncome = FinancialCalc.decimal(0);
    let totalExpenses = FinancialCalc.decimal(0);
    let netProfit = FinancialCalc.decimal(0);
    
    if (profitLossResponse.body?.reports?.[0]?.rows) {
      const rows = profitLossResponse.body.reports[0].rows;
      
      // Find specific sections and their summary rows
      rows.forEach((row: any) => {
        if (row.rowType === 'Section') {
          // Income section
          if (row.title === 'Income' && row.rows) {
            row.rows.forEach((incomeRow: any) => {
              if (incomeRow.rowType === 'SummaryRow' && incomeRow.cells?.[0]?.value === 'Total Income') {
                totalIncome = FinancialCalc.decimal(incomeRow.cells[1]?.value || '0');
              }
            });
          }
          // Cost of Sales section  
          else if (row.title === 'Less Cost of Sales' && row.rows) {
            row.rows.forEach((costRow: any) => {
              if (costRow.rowType === 'SummaryRow' && costRow.cells?.[0]?.value === 'Total Cost of Sales') {
                // Add cost of sales to expenses
                const costOfSales = FinancialCalc.decimal(costRow.cells[1]?.value || '0');
                totalExpenses = totalExpenses.plus(costOfSales);
              }
            });
          }
          // Operating Expenses section
          else if (row.title === 'Less Operating Expenses' && row.rows) {
            row.rows.forEach((expenseRow: any) => {
              if (expenseRow.rowType === 'SummaryRow' && expenseRow.cells?.[0]?.value === 'Total Operating Expenses') {
                const operatingExpenses = FinancialCalc.decimal(expenseRow.cells[1]?.value || '0');
                totalExpenses = totalExpenses.plus(operatingExpenses);
              }
            });
          }
        }
        // Check for direct Net Profit row in empty sections
        else if (row.rowType === 'Section' && row.title === '' && row.rows) {
          row.rows.forEach((profitRow: any) => {
            if (profitRow.rowType === 'Row' && profitRow.cells?.[0]?.value === 'Net Profit') {
              netProfit = FinancialCalc.decimal(profitRow.cells[1]?.value || '0');
            }
          });
        }
      });
      
      // If net profit not found, calculate it
      if (netProfit.isZero() && (!totalIncome.isZero() || !totalExpenses.isZero())) {
        netProfit = totalIncome.minus(totalExpenses);
      }
    }
    
    console.log('Successfully fetched financial summary:', {
      current: currentBS,
      historical: historicalBS,
      totalIncome: FinancialCalc.toNumber(totalIncome),
      totalExpenses: FinancialCalc.toNumber(totalExpenses),
      netProfit: FinancialCalc.toNumber(netProfit)
    });
    
    // Calculate changes using decimal precision
    const changeAssets = FinancialCalc.subtract(currentBS.totalAssets, historicalBS.totalAssets);
    const changeLiabilities = FinancialCalc.subtract(currentBS.totalLiabilities, historicalBS.totalLiabilities);
    const changeNetAssets = FinancialCalc.subtract(currentBS.netAssets, historicalBS.netAssets);
    const changeCashInBank = FinancialCalc.subtract(currentBS.cashInBank, historicalBS.cashInBank);
    
    const response = {
      success: true,
      balanceSheet: {
        current: {
          totalAssets: currentBS.totalAssets,
          totalLiabilities: currentBS.totalLiabilities,
          netAssets: currentBS.netAssets,
          cashInBank: currentBS.cashInBank,
          asOfDate: toDate
        },
        historical: {
          totalAssets: historicalBS.totalAssets,
          totalLiabilities: historicalBS.totalLiabilities,
          netAssets: historicalBS.netAssets,
          cashInBank: historicalBS.cashInBank,
          asOfDate: fromDate
        },
        changes: {
          totalAssets: FinancialCalc.toNumber(changeAssets),
          totalLiabilities: FinancialCalc.toNumber(changeLiabilities),
          netAssets: FinancialCalc.toNumber(changeNetAssets),
          cashInBank: FinancialCalc.toNumber(changeCashInBank)
        }
      },
      profitLoss: {
        totalIncome: FinancialCalc.toNumber(totalIncome),
        totalExpenses: FinancialCalc.toNumber(totalExpenses),
        netProfit: FinancialCalc.toNumber(netProfit),
        period: {
          from: fromDate,
          to: toDate
        }
      },
      currency: 'GBP',
      source: 'xero-api',
      lastUpdated: new Date().toISOString()
    };
    
    // Log successful financial summary generation
    await auditLogger.logSuccess(
      AuditAction.REPORT_GENERATE,
      AuditResource.FINANCIAL_SUMMARY,
      {
        metadata: {
          period,
          dateRange: { from: fromDate, to: toDate },
          tenant: tenants[0].tenantName
        },
        duration: Date.now() - startTime
      }
    );
    
    return NextResponse.json(response);
    
  } catch (error: any) {
    console.error('Financial summary error:', error);
    
    // Log failure
    await auditLogger.logFailure(
      AuditAction.REPORT_GENERATE,
      AuditResource.FINANCIAL_SUMMARY,
      error,
      {
        metadata: {
          period: request.nextUrl.searchParams.get('period') || '30d'
        },
        duration: Date.now() - startTime
      }
    );
    
    return NextResponse.json({
      error: 'Failed to fetch financial summary',
      details: error.message
    }, { status: 500 });
  }
  }
)
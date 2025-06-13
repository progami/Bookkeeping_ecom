import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
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
    
    // Get query parameters for date range
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';
    
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
    const findValueInRows = (rows: any[], searchTerms: string[]): number => {
      for (const row of rows) {
        if (row.cells && row.cells.length > 0) {
          const label = (row.cells[0]?.value || '').toLowerCase();
          const isMatch = searchTerms.some(term => label.includes(term.toLowerCase()));
          
          if (isMatch) {
            // Try to find value in cells (usually in cell[1] for reports)
            for (let i = 1; i < row.cells.length; i++) {
              const value = parseFloat(row.cells[i]?.value || '0');
              if (!isNaN(value) && value !== 0) {
                return value;
              }
            }
          }
        }
        
        // Recursively search in nested rows
        if (row.rows && row.rows.length > 0) {
          const nestedValue = findValueInRows(row.rows, searchTerms);
          if (nestedValue !== 0) {
            return nestedValue;
          }
        }
      }
      return 0;
    };
    
    // Helper function to extract balance sheet values
    const extractBalanceSheetValues = (balanceSheet: any) => {
      let totalAssets = 0;
      let totalLiabilities = 0;
      let netAssets = 0;
      let cashInBank = 0;
      
      if (balanceSheet.body?.reports?.[0]?.rows) {
        const rows = balanceSheet.body.reports[0].rows;
        
        rows.forEach((row: any) => {
          // Find Bank section for cash in bank
          if (row.rowType === 'Section' && row.title === 'Bank' && row.rows) {
            row.rows.forEach((bankRow: any) => {
              if (bankRow.rowType === 'SummaryRow' && bankRow.cells?.[0]?.value === 'Total Bank') {
                cashInBank = parseFloat(bankRow.cells[1]?.value || '0');
              }
            });
          }
          // Find summary rows for totals
          else if (row.rowType === 'Section' && row.title === '' && row.rows) {
            row.rows.forEach((summaryRow: any) => {
              if (summaryRow.rowType === 'SummaryRow' && summaryRow.cells?.[0]?.value === 'Total Assets') {
                totalAssets = parseFloat(summaryRow.cells[1]?.value || '0');
              } else if (summaryRow.rowType === 'SummaryRow' && summaryRow.cells?.[0]?.value === 'Total Liabilities') {
                totalLiabilities = parseFloat(summaryRow.cells[1]?.value || '0');
              } else if (summaryRow.rowType === 'Row' && summaryRow.cells?.[0]?.value === 'Net Assets') {
                netAssets = parseFloat(summaryRow.cells[1]?.value || '0');
              }
            });
          }
        });
        
        // Calculate net assets if not found
        if (netAssets === 0 && (totalAssets > 0 || totalLiabilities > 0)) {
          netAssets = totalAssets - totalLiabilities;
        }
      }
      
      return { totalAssets, totalLiabilities, netAssets, cashInBank };
    };
    
    // Process current and historical balance sheets
    const currentBS = extractBalanceSheetValues(currentBalanceSheet);
    const historicalBS = extractBalanceSheetValues(historicalBalanceSheet);
    
    // Process P&L Report  
    let totalIncome = 0;
    let totalExpenses = 0;
    let netProfit = 0;
    
    if (profitLossResponse.body?.reports?.[0]?.rows) {
      const rows = profitLossResponse.body.reports[0].rows;
      
      // Find specific sections and their summary rows
      rows.forEach((row: any) => {
        if (row.rowType === 'Section') {
          // Income section
          if (row.title === 'Income' && row.rows) {
            row.rows.forEach((incomeRow: any) => {
              if (incomeRow.rowType === 'SummaryRow' && incomeRow.cells?.[0]?.value === 'Total Income') {
                totalIncome = parseFloat(incomeRow.cells[1]?.value || '0');
              }
            });
          }
          // Cost of Sales section  
          else if (row.title === 'Less Cost of Sales' && row.rows) {
            row.rows.forEach((costRow: any) => {
              if (costRow.rowType === 'SummaryRow' && costRow.cells?.[0]?.value === 'Total Cost of Sales') {
                // Add cost of sales to expenses
                totalExpenses += parseFloat(costRow.cells[1]?.value || '0');
              }
            });
          }
          // Operating Expenses section
          else if (row.title === 'Less Operating Expenses' && row.rows) {
            row.rows.forEach((expenseRow: any) => {
              if (expenseRow.rowType === 'SummaryRow' && expenseRow.cells?.[0]?.value === 'Total Operating Expenses') {
                totalExpenses += parseFloat(expenseRow.cells[1]?.value || '0');
              }
            });
          }
        }
        // Check for direct Net Profit row in empty sections
        else if (row.rowType === 'Section' && row.title === '' && row.rows) {
          row.rows.forEach((profitRow: any) => {
            if (profitRow.rowType === 'Row' && profitRow.cells?.[0]?.value === 'Net Profit') {
              netProfit = parseFloat(profitRow.cells[1]?.value || '0');
            }
          });
        }
      });
      
      // If net profit not found, calculate it
      if (netProfit === 0 && (totalIncome > 0 || totalExpenses > 0)) {
        netProfit = totalIncome - totalExpenses;
      }
    }
    
    console.log('Successfully fetched financial summary:', {
      current: currentBS,
      historical: historicalBS,
      totalIncome,
      totalExpenses,
      netProfit
    });
    
    return NextResponse.json({
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
          totalAssets: currentBS.totalAssets - historicalBS.totalAssets,
          totalLiabilities: currentBS.totalLiabilities - historicalBS.totalLiabilities,
          netAssets: currentBS.netAssets - historicalBS.netAssets,
          cashInBank: currentBS.cashInBank - historicalBS.cashInBank
        }
      },
      profitLoss: {
        totalIncome,
        totalExpenses,
        netProfit,
        period: {
          from: fromDate,
          to: toDate
        }
      },
      currency: 'GBP',
      source: 'xero-api',
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Financial summary error:', error);
    return NextResponse.json({
      error: 'Failed to fetch financial summary',
      details: error.message
    }, { status: 500 });
  }
}
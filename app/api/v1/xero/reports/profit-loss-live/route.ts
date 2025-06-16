import { NextRequest, NextResponse } from 'next/server';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withErrorHandling, createError } from '@/lib/errors/error-handler';
import { xeroDataManager } from '@/lib/xero-data-manager';

export const GET = withErrorHandling(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      // Set cache headers for performance
      const responseHeaders = {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'max-age=600',
      };

      // Use tenant ID from session
      const tenantId = session.user.tenantId;
      if (!tenantId) {
        throw createError.authentication('No tenant ID in session');
      }

      // Get the time range from query params or use defaults
      const searchParams = request.nextUrl.searchParams;
      const timeRange = searchParams.get('timeRange') || '30d';
      
      // Calculate date range
      const toDate = new Date();
      const fromDate = new Date();
      
      switch(timeRange) {
        case '7d':
          fromDate.setDate(fromDate.getDate() - 7);
          break;
        case '30d':
          fromDate.setDate(fromDate.getDate() - 30);
          break;
        case '90d':
          fromDate.setDate(fromDate.getDate() - 90);
          break;
        case 'ytd':
          fromDate.setMonth(0, 1); // January 1st of current year
          break;
        default:
          fromDate.setDate(fromDate.getDate() - 30);
      }

      // Get profit & loss report from unified data manager
      const xeroDataSet = await xeroDataManager.getAllData(tenantId);
      const report = xeroDataSet.reports.profitLoss;
    if (!report || !report.rows) {
      throw new Error('Invalid profit & loss response from Xero');
    }

    // Parse the P&L data
    let totalRevenue = 0;
    let totalExpenses = 0;
    let netProfit = 0;
    let grossProfit = 0;
    let operatingExpenses = 0;

    // Extract values from the report rows
    report.rows.forEach((row: any) => {
      if (row.rowType === 'Section' as any) {
        const sectionTitle = row.title?.toLowerCase() || '';
        
        // Find the total row in this section
        const totalRow = row.rows?.find((r: any) => 
          r.rowType === 'Row' as any && 
          (r.cells?.[0]?.value?.toString().toLowerCase().includes('total') || false)
        );

        if (totalRow && totalRow.cells) {
          // Get the current period value (first value cell after the label)
          const currentValue = parseFloat(totalRow.cells[1]?.value?.toString() || '0');

          if (sectionTitle.includes('income') || sectionTitle.includes('revenue')) {
            totalRevenue = currentValue;
          } else if (sectionTitle.includes('expense')) {
            totalExpenses = Math.abs(currentValue);
          } else if (sectionTitle.includes('gross profit')) {
            grossProfit = currentValue;
          }
        }
      }
    });

    // Look for net profit row
    const netProfitRow = report.rows.find((row: any) => 
      row.rowType === 'Row' as any && 
      row.cells?.[0]?.value?.toString().toLowerCase().includes('net profit')
    );

    if (netProfitRow) {
      netProfit = parseFloat(netProfitRow.cells?.[1]?.value?.toString() || '0');
    } else {
      // Calculate if not found
      netProfit = totalRevenue - totalExpenses;
    }

    // Calculate operating expenses
    operatingExpenses = totalExpenses;

    // Calculate period-over-period changes if we have multiple periods
    let revenueChange = 0;
    let profitChange = 0;

    if (report.rows.length > 0) {
      // Find revenue comparison
      const revenueSection = report.rows.find((row: any) => 
        row.title?.toLowerCase().includes('income') || 
        row.title?.toLowerCase().includes('revenue')
      );

      if (revenueSection && revenueSection.rows) {
        const totalRevenueRow = revenueSection.rows.find((r: any) => 
          r.cells?.[0]?.value?.toString().toLowerCase().includes('total')
        );

        if (totalRevenueRow && totalRevenueRow.cells && totalRevenueRow.cells.length > 2) {
          const currentPeriod = parseFloat(totalRevenueRow.cells[1]?.value?.toString() || '0');
          const previousPeriod = parseFloat(totalRevenueRow.cells[2]?.value?.toString() || '0');
          
          if (previousPeriod !== 0) {
            revenueChange = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
          }
        }
      }

      // Find profit comparison
      const netProfitRowForChange = report.rows.find((row: any) => 
        row.rowType === 'Row' as any && 
        row.cells?.[0]?.value?.toString().toLowerCase().includes('net profit')
      );

      if (netProfitRowForChange && netProfitRowForChange.cells && netProfitRowForChange.cells.length > 2) {
        const currentPeriod = parseFloat(netProfitRowForChange.cells[1]?.value?.toString() || '0');
        const previousPeriod = parseFloat(netProfitRowForChange.cells[2]?.value?.toString() || '0');
        
        if (previousPeriod !== 0) {
          profitChange = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
        }
      }
    }

      return NextResponse.json({
        revenue: totalRevenue,
        expenses: totalExpenses,
        netProfit,
        grossProfit,
        operatingExpenses,
        revenueChange,
        profitChange,
        periodStart: fromDate.toISOString(),
        periodEnd: toDate.toISOString(),
        timeRange,
        source: 'xero_api'
      }, {
        headers: responseHeaders
      });
    }
  )
);
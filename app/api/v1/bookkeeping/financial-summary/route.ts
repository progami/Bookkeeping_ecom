import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { FinancialCalc } from '@/lib/financial-calculations';
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger';
import { withValidation } from '@/lib/validation/middleware';
import { z } from 'zod';
import { XeroReportParser } from '@/lib/xero-report-parser';

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
    
    // Initialize the report parser
    const reportParser = new XeroReportParser();
    
    // Process current and historical balance sheets
    const currentBS = reportParser.parseBalanceSheet(currentBalanceSheet);
    const historicalBS = reportParser.parseBalanceSheet(historicalBalanceSheet);
    
    // Process P&L Report
    const plResult = reportParser.parseProfitAndLoss(profitLossResponse);
    const totalIncome = FinancialCalc.decimal(plResult.totalIncome);
    const totalExpenses = FinancialCalc.decimal(plResult.totalExpenses);
    const netProfit = FinancialCalc.decimal(plResult.netProfit);
    
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
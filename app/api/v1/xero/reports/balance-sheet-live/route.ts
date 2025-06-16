import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withErrorHandling, createError } from '@/lib/errors/error-handler';
import { xeroDataCache, CacheKey } from '@/lib/xero-data-cache';
import { executeXeroAPICall } from '@/lib/xero-client-with-rate-limit';

export const GET = withErrorHandling(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      // Set cache headers for performance
      const responseHeaders = {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'CDN-Cache-Control': 'max-age=600',
      };

      // Get Xero client
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        throw createError.authentication('Not connected to Xero');
      }

      const { client: xero, tenantId } = xeroData;

      // Get balance sheet from cache or Xero API
      const balanceSheetResponse = await xeroDataCache.get(
        CacheKey.BALANCE_SHEET,
        tenantId,
        session.user.userId,
        async () => {
          const response = await executeXeroAPICall(() =>
            xero.accountingApi.getReportBalanceSheet(
              tenantId,
              undefined, // date - uses today if not specified
              3, // periods
              'MONTH' // timeframe
            )
          );
          return response;
        },
        undefined,
        5 * 60 * 1000 // 5 minute cache
      );

      const report = balanceSheetResponse.body.reports?.[0];
    if (!report || !report.rows) {
      throw new Error('Invalid balance sheet response from Xero');
    }

    // Parse the balance sheet data
    let totalAssets = 0;
    let totalLiabilities = 0;
    let netAssets = 0;
    let cashInBank = 0;
    let currentAssets = 0;
    let currentLiabilities = 0;
    let equity = 0;

    // Extract values from the report rows
    report.rows.forEach(row => {
      if (row.rowType === 'Section' as any) {
        const sectionTitle = row.title?.toLowerCase() || '';
        
        // Find the total row in this section
        const totalRow = row.rows?.find(r => 
          r.rowType === 'Row' as any && 
          (r.cells?.[0]?.value?.toString().toLowerCase().includes('total') || false)
        );

        if (totalRow && totalRow.cells) {
          // Get the current period value (first value cell after the label)
          const currentValue = parseFloat(totalRow.cells[1]?.value?.toString() || '0');

          if (sectionTitle.includes('asset')) {
            totalAssets = currentValue;
          } else if (sectionTitle.includes('liabilities')) {
            totalLiabilities = Math.abs(currentValue); // Liabilities are often negative
          } else if (sectionTitle.includes('equity')) {
            equity = currentValue;
          }
        }

        // Look for specific line items
        row.rows?.forEach((itemRow: any) => {
          if (itemRow.rowType === 'Row' as any && itemRow.cells && itemRow.cells.length > 1) {
            const itemName = itemRow.cells[0]?.value?.toString().toLowerCase() || '';
            const itemValue = parseFloat(itemRow.cells[1]?.value?.toString() || '0');

            // Extract cash and bank accounts
            if (itemName.includes('cash') || itemName.includes('bank')) {
              cashInBank += itemValue;
            }

            // Track current assets/liabilities
            if (sectionTitle.includes('current asset')) {
              currentAssets += itemValue;
            } else if (sectionTitle.includes('current liabilit')) {
              currentLiabilities += Math.abs(itemValue);
            }
          }
        });
      }
    });

    // Calculate net assets
    netAssets = totalAssets - totalLiabilities;

      // Get additional bank account details from cache
      const bankAccountsResponse = await xeroDataCache.get(
        CacheKey.BANK_ACCOUNTS,
        tenantId,
        session.user.userId,
        async () => {
          const response = await executeXeroAPICall(() =>
            xero.accountingApi.getAccounts(
              tenantId,
              undefined,
              'Type=="BANK"&&Status=="ACTIVE"'
            )
          );
          return response;
        },
        undefined,
        5 * 60 * 1000 // 5 minute cache
      );

      let detailedCashInBank = 0;
      const bankAccounts = bankAccountsResponse.body.accounts || [];
    
    // Note: getReportBankSummary in this version doesn't support account-specific queries
    // We'll rely on the balance sheet calculation instead

    // Use the more accurate value
    if (detailedCashInBank > 0) {
      cashInBank = detailedCashInBank;
    }

      return NextResponse.json({
        totalAssets,
        totalLiabilities,
        netAssets,
        equity,
        currentAssets,
        currentLiabilities,
        cashInBank,
        accountsReceivable: 0, // Would need to parse from report
        accountsPayable: 0, // Would need to parse from report
        inventory: 0, // Would need to parse from report
        reportDate: new Date().toISOString(),
        source: 'xero_api'
      }, {
        headers: responseHeaders
      });
    }
  )
);
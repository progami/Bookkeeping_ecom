import { NextRequest, NextResponse } from 'next/server';
import { BankTransaction, AccountType } from 'xero-node';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withErrorHandling, createError } from '@/lib/errors/error-handler';
import { xeroDataManager } from '@/lib/xero-data-manager';

export const GET = withErrorHandling(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      // Use tenant ID from session
      const tenantId = session.user.tenantId;
      if (!tenantId) {
        throw createError.authentication('No tenant ID in session');
      }

      // First, get the VAT return report which shows current VAT liability
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last quarter

      // Get all data from unified data manager
      const xeroDataSet = await xeroDataManager.getAllData(tenantId);
      
      // Get VAT liability data from the unified dataset
      const allAccounts = xeroDataSet.accounts;
      
      // Filter for tax/VAT related accounts based on account type
      // Tax accounts typically have Type "CURRLIAB" (Current Liability) and are tax-related
      const vatAccounts = allAccounts.filter((account: any) => {
        // Check if it's a tax account by type and name
        const isTaxType = account.type === AccountType.CURRLIAB || account.type === AccountType.LIABILITY;
        const isTaxName = account.name?.toLowerCase().includes('vat') || 
                          account.name?.toLowerCase().includes('gst') ||
                          account.name?.toLowerCase().includes('tax') ||
                          account.taxType === 'OUTPUT' ||
                          account.taxType === 'INPUT' ||
                          account.taxType === 'GSTONIMPORTS';
        
        return isTaxType && isTaxName;
      });

      let totalVatLiability = 0;

      // Get current balance for each VAT account from cached VAT liability report
      const vatReport = xeroDataSet.reports.vatLiability;
      if (vatReport && vatReport.rows) {
        // Find this account in the report
        for (const section of vatReport.rows) {
          if (section.rows) {
            vatAccounts.forEach((account: any) => {
              const accountRow = section.rows?.find((row: any) => 
                row.cells?.[0]?.value === account.code || 
                row.cells?.[1]?.value === account.name
              );
              
              if (accountRow && accountRow.cells) {
                // Trial balance shows debits and credits
                const debit = parseFloat(accountRow.cells[3]?.value?.toString() || '0');
                const credit = parseFloat(accountRow.cells[4]?.value?.toString() || '0');
                const balance = credit - debit; // For liability accounts, credit - debit
                
                totalVatLiability += balance;
                console.log(`VAT Account ${account.name} (${account.code}): ${balance}`);
              }
            });
          }
        }
      }

      // Also check if we have any tax reports available
      let vatOnSales = 0;
      let vatOnPurchases = 0;

      // Use cached transactions data
      const bankTransactions = xeroDataSet.transactions.filter((tx: any) => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && txDate <= endDate;
      });
      
      bankTransactions.forEach((tx: any) => {
        if (tx.lineItems) {
          tx.lineItems.forEach((item: any) => {
            if (item.taxAmount) {
              if (tx.type === BankTransaction.TypeEnum.RECEIVE) {
                vatOnSales += item.taxAmount;
              } else if (tx.type === BankTransaction.TypeEnum.SPEND) {
                vatOnPurchases += item.taxAmount;
              }
            }
          });
        }
      });

      const netVat = vatOnSales - vatOnPurchases;

      const vatLiabilityData = {
        currentLiability: totalVatLiability || Math.abs(netVat),
        vatCollected: vatOnSales,
        vatPaid: vatOnPurchases,
        netAmount: totalVatLiability || netVat,
        vatAccounts: vatAccounts.map((acc: any) => ({
          name: acc.name,
          code: acc.code,
          accountID: acc.accountID
        })),
        reportDate: new Date().toISOString(),
        reportPeriod: 'Current',
        currency: 'GBP',
        source: 'xero_unified_data'
      };

      return NextResponse.json(vatLiabilityData);
    }
  )
);
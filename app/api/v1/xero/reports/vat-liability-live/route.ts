import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { BankTransaction, AccountType } from 'xero-node';
import { withAuthValidation } from '@/lib/auth/auth-wrapper';
import { ValidationLevel } from '@/lib/auth/session-validation';
import { withErrorHandling, createError } from '@/lib/errors/error-handler';
import { xeroDataCache, CacheKey } from '@/lib/xero-data-cache';
import { executeXeroAPICall } from '@/lib/xero-client-with-rate-limit';

export const GET = withErrorHandling(
  withAuthValidation(
    { authLevel: ValidationLevel.XERO },
    async (request, { session }) => {
      // Get Xero client
      const xeroData = await getXeroClientWithTenant();
      if (!xeroData) {
        throw createError.authentication('Not connected to Xero');
      }

      const { client: xero, tenantId } = xeroData;

      // First, get the VAT return report which shows current VAT liability
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3); // Last quarter

      // Get VAT liability data from cache or Xero API
      const vatLiabilityData = await xeroDataCache.get(
        CacheKey.VAT_LIABILITY,
        tenantId,
        session.user.userId,
        async () => {
          // First, get ALL accounts from Xero
          const allAccountsResponse = await executeXeroAPICall(() =>
            xero.accountingApi.getAccounts(
              tenantId,
              undefined,
              'Status=="ACTIVE"' as any
            )
          );

          const allAccounts = (allAccountsResponse as any).body.accounts || [];
          
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

          // Get current balance for each VAT account
          for (const account of vatAccounts) {
            if (account.accountID) {
              try {
                // Get the account balance from a trial balance or transactions
                const trialBalanceResponse = await executeXeroAPICall(() =>
                  xero.accountingApi.getReportTrialBalance(
                    tenantId,
                    new Date().toISOString().split('T')[0] as any // Today's date
                  )
                );
                
                const report = (trialBalanceResponse as any).body.reports?.[0];
                if (report && report.rows) {
                  // Find this account in the trial balance
                  for (const section of report.rows) {
                    if (section.rows) {
                      const accountRow = section.rows.find((row: any) => 
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
                    }
                  }
                }
              } catch (error) {
                console.error(`Error getting balance for VAT account ${account.name}:`, error);
              }
            }
          }

          // Also check if we have any tax reports available
          let vatOnSales = 0;
          let vatOnPurchases = 0;

          try {
            // Try to get more detailed VAT information from transactions
            const recentTransactions = await executeXeroAPICall(() =>
              xero.accountingApi.getBankTransactions(
                tenantId,
                undefined,
                `Date>DateTime(${startDate.toISOString()})` as any,
                undefined,
                100 as any
              )
            );

            const bankTransactions = (recentTransactions as any).body.bankTransactions || [];
            
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
          } catch (error) {
            console.log('Could not fetch detailed transaction data for VAT calculation');
          }

          const netVat = vatOnSales - vatOnPurchases;

          return {
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
            source: 'xero_vat_accounts'
          };
        },
        undefined,
        5 * 60 * 1000 // 5 minute cache
      );

      return NextResponse.json(vatLiabilityData);
    }
  )
);
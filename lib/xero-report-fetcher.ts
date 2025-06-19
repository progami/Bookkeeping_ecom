import { getXeroClient } from './xero-client';
import { executeXeroAPICall } from './xero-api-helpers';
import { structuredLogger } from './logger';

interface BalanceSheetSummary {
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  currentAssets: number;
  currentLiabilities: number;
  equity: number;
  cash: number;
  accountsReceivable: number;
  accountsPayable: number;
  inventory: number;
}

interface ProfitLossSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  grossProfit: number;
  operatingExpenses: number;
  otherIncome: number;
  otherExpenses: number;
}

interface TrialBalanceSummary {
  accounts: Array<{
    accountId: string;
    accountName: string;
    accountCode: string;
    accountType: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
}

/**
 * Optimized report fetching using Xero's newer endpoints and direct data access
 */
export class XeroReportFetcher {
  /**
   * Fetch Balance Sheet summary using accounts endpoint
   * More efficient than parsing the report endpoint
   */
  static async fetchBalanceSheetSummary(tenantId: string): Promise<BalanceSheetSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      // Fetch all accounts with their balances
      const accountsResponse = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getAccounts(
          tenantId,
          undefined, // modifiedAfter
          undefined, // where
          'Type,SystemAccount' // order
        )
      );
      
      const accounts = accountsResponse?.body?.accounts || [];
      
      // Initialize summary
      const summary: BalanceSheetSummary = {
        totalAssets: 0,
        totalLiabilities: 0,
        netAssets: 0,
        currentAssets: 0,
        currentLiabilities: 0,
        equity: 0,
        cash: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        inventory: 0
      };
      
      // Process accounts
      accounts.forEach((account: any) => {
        const balance = account.reportingCodeLineAmount || 0;
        const type = account.type;
        const systemAccount = account.systemAccount;
        
        switch (type) {
          case 'BANK':
            summary.cash += balance;
            summary.currentAssets += balance;
            summary.totalAssets += balance;
            break;
            
          case 'CURRENT':
            if (systemAccount === 'DEBTORS') {
              summary.accountsReceivable += balance;
            }
            summary.currentAssets += balance;
            summary.totalAssets += balance;
            break;
            
          case 'CURRLIAB':
            if (systemAccount === 'CREDITORS') {
              summary.accountsPayable += Math.abs(balance);
            }
            summary.currentLiabilities += Math.abs(balance);
            summary.totalLiabilities += Math.abs(balance);
            break;
            
          case 'INVENTORY':
            summary.inventory += balance;
            summary.currentAssets += balance;
            summary.totalAssets += balance;
            break;
            
          case 'FIXED':
          case 'DEPRECIATN':
          case 'OTHERASSET':
            summary.totalAssets += balance;
            break;
            
          case 'TERMLIAB':
          case 'LIABILITY':
            summary.totalLiabilities += Math.abs(balance);
            break;
            
          case 'EQUITY':
            summary.equity += balance;
            break;
        }
      });
      
      // Calculate net assets
      summary.netAssets = summary.totalAssets - summary.totalLiabilities;
      
      structuredLogger.debug('Balance sheet summary calculated', {
        component: 'xero-report-fetcher',
        tenantId,
        summary
      });
      
      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch balance sheet summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Fetch Profit & Loss summary using newer endpoint
   */
  static async fetchProfitLossSummary(
    tenantId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<ProfitLossSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      // Use the profit and loss endpoint with date parameters
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportProfitAndLoss(
          tenantId,
          fromDate?.toISOString(),
          toDate?.toISOString(),
          undefined, // periods
          undefined, // timeframe
          undefined, // trackingCategoryID
          undefined, // trackingCategoryID2
          undefined, // trackingOptionID
          undefined, // trackingOptionID2
          true, // standardLayout
          false // paymentsOnly
        )
      );
      
      const report = response?.body?.reports?.[0];
      
      // Initialize summary
      const summary: ProfitLossSummary = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        grossProfit: 0,
        operatingExpenses: 0,
        otherIncome: 0,
        otherExpenses: 0
      };
      
      if (report && report.rows) {
        // Parse the report structure
        report.rows.forEach((section: any) => {
          if (section.rowType === 'Section') {
            const sectionTitle = section.title?.toLowerCase() || '';
            
            section.rows?.forEach((row: any) => {
              if (row.rowType === 'Row' && row.cells?.length > 1) {
                const value = parseFloat(row.cells[1]?.value || '0');
                const rowTitle = row.cells[0]?.value?.toLowerCase() || '';
                
                if (sectionTitle.includes('income') || sectionTitle.includes('revenue')) {
                  if (rowTitle.includes('total')) {
                    summary.totalRevenue = value;
                  }
                } else if (sectionTitle.includes('expense')) {
                  if (rowTitle.includes('total')) {
                    summary.totalExpenses = Math.abs(value);
                  }
                } else if (sectionTitle.includes('gross profit')) {
                  summary.grossProfit = value;
                } else if (sectionTitle.includes('operating expense')) {
                  summary.operatingExpenses = Math.abs(value);
                }
              }
            });
          }
        });
      }
      
      // Calculate net profit
      summary.netProfit = summary.totalRevenue - summary.totalExpenses;
      
      structuredLogger.debug('Profit & Loss summary calculated', {
        component: 'xero-report-fetcher',
        tenantId,
        summary
      });
      
      return summary;
    } catch (error) {
      structuredLogger.error('Failed to fetch P&L summary', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Fetch Trial Balance for detailed account balances
   */
  static async fetchTrialBalance(
    tenantId: string,
    date?: Date
  ): Promise<TrialBalanceSummary> {
    try {
      const xeroClient = await getXeroClient();
      if (!xeroClient) {
        throw new Error('Xero client not available');
      }
      
      const response = await executeXeroAPICall<any>(
        xeroClient,
        tenantId,
        (client) => client.accountingApi.getReportTrialBalance(
          tenantId,
          date?.toISOString(),
          false // paymentsOnly
        )
      );
      
      const report = response?.body?.reports?.[0];
      const accounts: TrialBalanceSummary['accounts'] = [];
      let totalDebits = 0;
      let totalCredits = 0;
      
      if (report && report.rows) {
        // Find the section with account data
        const accountSection = report.rows.find(
          (row: any) => row.rowType === 'Section' && row.rows
        );
        
        if (accountSection) {
          accountSection.rows.forEach((row: any) => {
            if (row.rowType === 'Row' && row.cells?.length >= 4) {
              const accountName = row.cells[0]?.value || '';
              const debit = parseFloat(row.cells[1]?.value || '0');
              const credit = parseFloat(row.cells[2]?.value || '0');
              const ytd = parseFloat(row.cells[3]?.value || '0');
              
              // Extract account code from name if present
              const codeMatch = accountName.match(/^(\d+)\s*-\s*(.+)$/);
              const accountCode = codeMatch ? codeMatch[1] : '';
              const cleanName = codeMatch ? codeMatch[2] : accountName;
              
              accounts.push({
                accountId: '', // Would need to match with accounts API
                accountName: cleanName,
                accountCode: accountCode,
                accountType: '', // Would need to match with accounts API
                debit: debit,
                credit: credit,
                balance: ytd
              });
              
              totalDebits += debit;
              totalCredits += credit;
            }
          });
        }
      }
      
      return {
        accounts,
        totalDebits,
        totalCredits
      };
    } catch (error) {
      structuredLogger.error('Failed to fetch trial balance', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      throw error;
    }
  }
  
  /**
   * Calculate VAT liability from trial balance
   */
  static async calculateVATLiability(tenantId: string): Promise<number> {
    try {
      const trialBalance = await this.fetchTrialBalance(tenantId);
      
      // Find VAT/GST accounts
      let vatLiability = 0;
      trialBalance.accounts.forEach(account => {
        const name = account.accountName.toLowerCase();
        if (
          name.includes('vat') || 
          name.includes('gst') || 
          name.includes('tax payable') ||
          name.includes('tax collected')
        ) {
          // VAT liability accounts typically have credit balances
          vatLiability += account.balance;
        }
      });
      
      return Math.abs(vatLiability);
    } catch (error) {
      structuredLogger.error('Failed to calculate VAT liability', error, {
        component: 'xero-report-fetcher',
        tenantId
      });
      return 0;
    }
  }
}
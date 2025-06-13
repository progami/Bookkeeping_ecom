import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Fetching P&L Report with YTD ===');
    
    // Get Xero client
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      console.log('No Xero client available');
      return NextResponse.json(
        { error: 'Xero client not initialized' },
        { status: 503 }
      );
    }

    const { client: xero, tenantId } = xeroData;
    
    // Get date range for YTD (from start of year to today)
    const currentDate = new Date();
    const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
    
    console.log('Fetching P&L report from Xero...');
    
    try {
      // Fetch P&L report from Xero
      const plReport = await xero.accountingApi.getReportProfitAndLoss(
        tenantId,
        startOfYear.toISOString().split('T')[0],  // fromDate
        currentDate.toISOString().split('T')[0],   // toDate
        undefined,  // periods
        undefined,  // timeframe
        undefined,  // trackingCategoryID
        undefined,  // trackingCategoryID2
        undefined,  // trackingOptionID
        undefined,  // trackingOptionID2
        true,       // standardLayout
        false       // paymentsOnly
      );

      // Parse the P&L report to extract YTD amounts by account code
      const ytdBalances: Record<string, number> = {};
      
      console.log('P&L Report body:', JSON.stringify(plReport.body, null, 2));
      
      if (plReport.body.reports && plReport.body.reports.length > 0) {
        const report = plReport.body.reports[0];
        console.log('Report rows count:', report.rows?.length);
        
        // Process each section of the P&L report
        if (report.rows) {
          for (const section of report.rows) {
            console.log('Section type:', section.rowType);
            
            // Process all row types, not just non-headers
            if (section.rows) {
              for (const row of section.rows) {
                // Look for rows with account data
                if (row.cells && row.cells.length > 0) {
                  // Check each cell for account information
                  for (let i = 0; i < row.cells.length; i++) {
                    const cell: any = row.cells[i];
                    
                    // Look for account attribute in any cell
                    if (cell.attributes) {
                      const accountAttr: any = cell.attributes.find((attr: any) => attr.id === 'account');
                      if (accountAttr && accountAttr.value) {
                        const accountCode = accountAttr.value;
                        
                        // Get the value from the same row (usually last cell or second cell)
                        let amount = 0;
                        
                        // Try last cell first (typical for reports)
                        const lastCell = row.cells[row.cells.length - 1];
                        if (lastCell && lastCell.value) {
                          const parsedAmount = parseFloat(lastCell.value.toString().replace(/[^0-9.-]/g, ''));
                          if (!isNaN(parsedAmount)) {
                            amount = parsedAmount;
                          }
                        }
                        
                        // If no amount in last cell, try other cells
                        if (amount === 0) {
                          for (let j = 1; j < row.cells.length; j++) {
                            const valueCell = row.cells[j];
                            if (valueCell && valueCell.value) {
                              const parsedAmount = parseFloat(valueCell.value.toString().replace(/[^0-9.-]/g, ''));
                              if (!isNaN(parsedAmount) && parsedAmount !== 0) {
                                amount = parsedAmount;
                                break;
                              }
                            }
                          }
                        }
                        
                        if (amount !== 0) {
                          ytdBalances[accountCode] = amount;
                          console.log(`Found YTD balance: ${accountCode} = ${amount}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Also fetch Balance Sheet for asset/liability accounts
      console.log('Fetching Balance Sheet from Xero...');
      const bsReport = await xero.accountingApi.getReportBalanceSheet(
        tenantId,
        currentDate.toISOString().split('T')[0],   // date
        undefined,  // periods
        undefined,  // timeframe
        undefined,  // trackingOptionID1
        undefined,  // trackingOptionID2
        true,       // standardLayout
        false       // paymentsOnly
      );

      // Parse Balance Sheet report
      console.log('Balance Sheet body:', JSON.stringify(bsReport.body, null, 2));
      
      if (bsReport.body.reports && bsReport.body.reports.length > 0) {
        const report = bsReport.body.reports[0];
        console.log('BS Report rows count:', report.rows?.length);
        
        if (report.rows) {
          for (const section of report.rows) {
            console.log('BS Section type:', section.rowType);
            
            if (section.rows) {
              for (const row of section.rows) {
                if (row.cells && row.cells.length > 0) {
                  // Check each cell for account information
                  for (let i = 0; i < row.cells.length; i++) {
                    const cell: any = row.cells[i];
                    
                    if (cell.attributes) {
                      const accountAttr: any = cell.attributes.find((attr: any) => attr.id === 'account');
                      if (accountAttr && accountAttr.value) {
                        const accountCode = accountAttr.value;
                        
                        // Get the value from the same row
                        let amount = 0;
                        
                        // Try last cell first
                        const lastCell = row.cells[row.cells.length - 1];
                        if (lastCell && lastCell.value) {
                          const parsedAmount = parseFloat(lastCell.value.toString().replace(/[^0-9.-]/g, ''));
                          if (!isNaN(parsedAmount)) {
                            amount = parsedAmount;
                          }
                        }
                        
                        // If no amount in last cell, try other cells
                        if (amount === 0) {
                          for (let j = 1; j < row.cells.length; j++) {
                            const valueCell = row.cells[j];
                            if (valueCell && valueCell.value) {
                              const parsedAmount = parseFloat(valueCell.value.toString().replace(/[^0-9.-]/g, ''));
                              if (!isNaN(parsedAmount) && parsedAmount !== 0) {
                                amount = parsedAmount;
                                break;
                              }
                            }
                          }
                        }
                        
                        if (amount !== 0) {
                          ytdBalances[accountCode] = amount;
                          console.log(`Found BS balance: ${accountCode} = ${amount}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      console.log('Total YTD balances found:', Object.keys(ytdBalances).length);
      console.log('YTD balances:', ytdBalances);

      // Get all accounts from database to merge with YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      // Merge YTD data with account information
      const accountsWithYTD = accounts.map(account => ({
        ...account,
        ytdAmount: account.code ? (ytdBalances[account.code] || 0) : 0
      }));

      // Calculate summary
      const summary = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0
      };

      accountsWithYTD.forEach(account => {
        const amount = account.ytdAmount || 0;
        
        switch (account.type) {
          case 'REVENUE':
          case 'OTHERINCOME':
            summary.totalRevenue += Math.abs(amount);
            break;
          case 'DIRECTCOSTS':
          case 'EXPENSE':
          case 'OVERHEADS':
            summary.totalExpenses += Math.abs(amount);
            break;
          case 'CURRENT':
          case 'FIXED':
          case 'INVENTORY':
            summary.totalAssets += amount;
            break;
          case 'CURRLIAB':
          case 'TERMLIAB':
            summary.totalLiabilities += Math.abs(amount);
            break;
          case 'EQUITY':
            summary.totalEquity += amount;
            break;
        }
      });

      summary.netProfit = summary.totalRevenue - summary.totalExpenses;

      return NextResponse.json({
        success: true,
        accounts: {
          all: accountsWithYTD,
          byType: accountsWithYTD.reduce((acc, account) => {
            const type = account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(account);
            return acc;
          }, {} as Record<string, any[]>)
        },
        hasYTDData: Object.keys(ytdBalances).length > 0,
        ytdBalances,
        summary,
        period: {
          from: startOfYear.toISOString(),
          to: currentDate.toISOString()
        }
      });

    } catch (xeroError: any) {
      console.error('Xero API error:', xeroError);
      
      // If Xero fails, return accounts without YTD data
      const accounts = await prisma.gLAccount.findMany({
        orderBy: { code: 'asc' }
      });

      return NextResponse.json({
        success: false,
        accounts: {
          all: accounts,
          byType: accounts.reduce((acc, account) => {
            const type = account.type;
            if (!acc[type]) acc[type] = [];
            acc[type].push(account);
            return acc;
          }, {} as Record<string, any[]>)
        },
        hasYTDData: false,
        error: 'Failed to fetch YTD data from Xero',
        message: xeroError.message
      });
    }

  } catch (error: any) {
    console.error('Error in P&L endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch P&L data',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
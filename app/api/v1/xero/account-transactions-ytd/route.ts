import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('[Account Transactions YTD] Fetching authoritative balances from database...');
    
    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '100');
    const skip = (page - 1) * pageSize;
    
    // Get current year start date for YTD
    const currentYear = new Date().getFullYear();
    const fromDate = new Date(`${currentYear}-01-01`);
    const toDate = new Date();
    
    // Get GL accounts with pagination and total count
    const [glAccounts, totalAccounts] = await Promise.all([
      prisma.gLAccount.findMany({
        where: {
          status: 'ACTIVE'
        },
        orderBy: {
          code: 'asc'
        },
        skip,
        take: pageSize
      }),
      prisma.gLAccount.count({
        where: {
          status: 'ACTIVE'
        }
      })
    ]);
    
    // Format response to match expected structure
    const accountsWithYTD = glAccounts.map(account => {
      const balance = Number(account.balance || 0);
      
      // For YTD amounts, use the authoritative balance from Trial Balance
      // The balance represents the YTD movement (net of debits and credits)
      // For expense and asset accounts, positive balance means more debits
      // For revenue and liability accounts, positive balance means more credits
      let ytdDebits = 0;
      let ytdCredits = 0;
      let ytdMovement = balance;
      
      // Determine debits/credits based on account type and balance
      if (account.type === 'EXPENSE' || account.class === 'EXPENSE' || 
          account.type === 'ASSET' || account.class === 'ASSET') {
        // For expense/asset accounts: positive balance = more debits
        if (balance > 0) {
          ytdDebits = Math.abs(balance);
          ytdCredits = 0;
        } else {
          ytdDebits = 0;
          ytdCredits = Math.abs(balance);
        }
      } else if (account.type === 'REVENUE' || account.class === 'REVENUE' || 
                 account.type === 'LIABILITY' || account.class === 'LIABILITY' ||
                 account.type === 'EQUITY' || account.class === 'EQUITY') {
        // For revenue/liability/equity accounts: positive balance = more credits
        if (balance > 0) {
          ytdDebits = 0;
          ytdCredits = Math.abs(balance);
        } else {
          ytdDebits = Math.abs(balance);
          ytdCredits = 0;
        }
      } else {
        // For other accounts, use absolute value for movement
        ytdMovement = Math.abs(balance);
      }
      
      return {
        accountID: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        class: account.class,
        status: account.status,
        description: account.description,
        systemAccount: account.systemAccount,
        enablePaymentsToAccount: account.enablePaymentsToAccount,
        showInExpenseClaims: account.showInExpenseClaims,
        reportingCode: account.reportingCode,
        reportingCodeName: account.reportingCodeName,
        ytdDebits: ytdDebits,
        ytdCredits: ytdCredits,
        ytdMovement: ytdMovement,
        ytdAmount: balance // The authoritative balance from Trial Balance
      };
    });
    
    // Log VAT accounts for debugging
    const vatAccounts = accountsWithYTD.filter(a => 
      a.code === '820' || 
      a.code === '825' || 
      a.name?.includes('VAT')
    );
    
    console.log('[Account Transactions YTD] VAT Accounts found:', vatAccounts.length);
    vatAccounts.forEach(vat => {
      console.log(`  - ${vat.name} (${vat.code}): YTD Amount = ${vat.ytdAmount}`);
    });
    
    const totalPages = Math.ceil(totalAccounts / pageSize);
    
    return NextResponse.json({
      accounts: accountsWithYTD,
      pagination: {
        page,
        pageSize,
        totalAccounts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      },
      dateRange: { 
        fromDate: fromDate.toISOString().split('T')[0], 
        toDate: toDate.toISOString().split('T')[0]
      }
    });
    
  } catch (error: any) {
    console.error('[Account Transactions YTD] Error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch account balances',
      message: error.message 
    }, { status: 500 });
  }
}
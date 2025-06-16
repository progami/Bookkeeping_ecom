import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('[Account Transactions YTD] Fetching from database...');
    
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
    
    // Get all bank transactions for YTD
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate
        },
        status: {
          not: 'DELETED'
        }
      }
    });
    
    // Calculate YTD totals by account code
    const accountTotals: Record<string, { debits: number, credits: number }> = {};
    
    // Initialize all accounts with zero
    glAccounts.forEach(account => {
      accountTotals[account.code] = { debits: 0, credits: 0 };
    });
    
    // Sum up transactions by account code
    bankTransactions.forEach(tx => {
      if (tx.accountCode && accountTotals[tx.accountCode]) {
        if (tx.type === 'RECEIVE') {
          accountTotals[tx.accountCode].credits += Math.abs(tx.amount?.toNumber() || 0);
        } else {
          accountTotals[tx.accountCode].debits += Math.abs(tx.amount?.toNumber() || 0);
        }
      }
    });
    
    // Format response to match expected structure
    const accountsWithYTD = glAccounts.map(account => {
      const totals = accountTotals[account.code] || { debits: 0, credits: 0 };
      const ytdMovement = totals.credits - totals.debits;
      
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
        ytdDebits: totals.debits,
        ytdCredits: totals.credits,
        ytdMovement: ytdMovement
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
      console.log(`  - ${vat.name} (${vat.code}): YTD Movement = ${vat.ytdMovement}`);
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
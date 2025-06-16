import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CurrencyService } from '@/lib/currency-service';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Fetching bank account balances', {
      component: 'cash-balance-api'
    });
    
    // Fetch all bank accounts from database
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        currencyCode: {
          not: null
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Calculate total balance in GBP
    let totalBalance = 0;
    const accountsWithBalance: any[] = [];
    const baseCurrency = 'GBP';
    
    // Process each account and convert to base currency
    for (const account of bankAccounts) {
      const accountCurrency = account.currencyCode || baseCurrency;
      
      try {
        // Get exchange rate using currency service
        const balanceInGBP = await CurrencyService.convert(
          account.balance,
          accountCurrency,
          baseCurrency,
          account.balanceLastUpdated || undefined
        );
        
        totalBalance += balanceInGBP;
        
        accountsWithBalance.push({
          id: account.id,
          name: account.name,
          code: account.code || '',
          balance: account.balance,
          balanceInGBP: balanceInGBP,
          currency: accountCurrency,
          type: 'BANK',
          lastUpdated: account.balanceLastUpdated || account.updatedAt
        });
      } catch (error) {
        structuredLogger.error('Failed to convert currency for account', error, {
          component: 'cash-balance-api',
          accountId: account.id,
          currency: accountCurrency
        });
        
        // Include account with unconverted balance
        accountsWithBalance.push({
          id: account.id,
          name: account.name,
          code: account.code || '',
          balance: account.balance,
          balanceInGBP: 0, // Unable to convert
          currency: accountCurrency,
          type: 'BANK',
          lastUpdated: account.balanceLastUpdated || account.updatedAt,
          conversionError: true
        });
      }
    }
    
    structuredLogger.info('Successfully calculated cash balance', {
      component: 'cash-balance-api',
      totalBalance,
      accountCount: accountsWithBalance.length
    });
    
    return NextResponse.json({
      totalBalance: totalBalance,
      currency: baseCurrency,
      accounts: accountsWithBalance,
      count: accountsWithBalance.length,
      lastUpdated: bankAccounts.length > 0 
        ? bankAccounts.reduce((latest, account) => {
            const accountDate = account.balanceLastUpdated || account.updatedAt;
            return accountDate > latest ? accountDate : latest;
          }, new Date(0)).toISOString()
        : new Date().toISOString()
    });
    
  } catch (error: any) {
    structuredLogger.error('Cash balance API error', error, {
      component: 'cash-balance-api'
    });
    
    return NextResponse.json({
      error: 'Failed to fetch cash balance',
      details: error.message
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CurrencyService } from '@/lib/currency-service';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    structuredLogger.info('Fetching bank account balances with dynamic calculation', {
      component: 'cash-balance-api'
    });
    
    // Fetch all bank accounts and calculate balances from transactions
    const [bankAccounts, transactionBalances] = await Promise.all([
      prisma.bankAccount.findMany({
        where: {
          currencyCode: {
            not: null
          }
        },
        orderBy: {
          name: 'asc'
        }
      }),
      // Calculate balances dynamically from transactions
      prisma.bankTransaction.groupBy({
        by: ['bankAccountId', 'type'],
        where: {
          status: { not: 'DELETED' }
        },
        _sum: {
          total: true
        }
      })
    ]);
    
    // Create a map of calculated balances from transactions
    const balanceMap = new Map<string, number>();
    
    // Process transaction balances
    transactionBalances.forEach(item => {
      const currentBalance = balanceMap.get(item.bankAccountId) || 0;
      const amount = Number(item._sum.total || 0);
      
      // RECEIVE transactions are positive, SPEND transactions are negative
      if (item.type === 'RECEIVE') {
        balanceMap.set(item.bankAccountId, currentBalance + amount);
      } else if (item.type === 'SPEND') {
        balanceMap.set(item.bankAccountId, currentBalance - amount);
      }
    });
    
    structuredLogger.info('Calculated dynamic balances', {
      component: 'cash-balance-api',
      balances: Object.fromEntries(balanceMap)
    });
    
    // Calculate total balance in GBP
    let totalBalance = 0;
    const accountsWithBalance: any[] = [];
    const baseCurrency = 'GBP';
    
    // Process each account and convert to base currency
    for (const account of bankAccounts) {
      const accountCurrency = account.currencyCode || baseCurrency;
      const calculatedBalance = balanceMap.get(account.id) || 0;
      
      structuredLogger.info(`Account ${account.name}: stored balance = ${account.balance}, calculated balance = ${calculatedBalance}`, {
        component: 'cash-balance-api',
        accountId: account.id
      });
      
      try {
        // Get exchange rate using currency service - use calculated balance instead of stored
        const balanceInGBP = await CurrencyService.convert(
          calculatedBalance,
          accountCurrency,
          baseCurrency,
          account.balanceLastUpdated || undefined
        );
        
        totalBalance += balanceInGBP;
        
        accountsWithBalance.push({
          id: account.id,
          name: account.name,
          code: account.code || '',
          balance: calculatedBalance, // Use calculated balance
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
          balance: calculatedBalance, // Use calculated balance
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
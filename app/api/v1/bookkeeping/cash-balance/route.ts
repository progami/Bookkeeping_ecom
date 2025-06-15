import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching bank account balances from database...');
    
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
    
    // Currency conversion rates (simplified - in real app, these would be fetched)
    const conversionRates: Record<string, number> = {
      'GBP': 1,
      'USD': 0.79, // Example rate
      'EUR': 0.86, // Example rate
      'PKR': 0.0028, // Example rate
      'SEK': 0.074 // Example rate
    };
    
    bankAccounts.forEach((account) => {
      const rate = conversionRates[account.currencyCode || 'GBP'] || 1;
      const balanceInGBP = account.balance.toNumber() * rate;
      totalBalance += balanceInGBP;
      
      accountsWithBalance.push({
        id: account.id,
        name: account.name,
        code: account.code || '',
        balance: account.balance,
        balanceInGBP: balanceInGBP,
        currency: account.currencyCode || 'GBP',
        type: 'BANK',
        lastUpdated: account.balanceLastUpdated || account.updatedAt
      });
    });
    
    console.log('Successfully fetched balance from database:', totalBalance);
    
    return NextResponse.json({
      totalBalance: totalBalance,
      currency: 'GBP',
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
    console.error('Cash balance error:', error);
    return NextResponse.json({
      error: 'Failed to fetch cash balance',
      details: error.message
    }, { status: 500 });
  }
}
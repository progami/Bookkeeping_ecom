import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xeroData = await getXeroClientWithTenant()
    
    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      )
    }

    const { client, tenantId } = xeroData

    console.log('Fetching bank account balances from Xero...');
    
    // Fetch bank accounts directly for more accurate data
    const accountsResponse = await client.accountingApi.getAccounts(
      tenantId,
      undefined,
      'Type=="BANK"',
      undefined
    );
    
    // Extract bank balances from accounts
    let totalBalance = 0;
    const bankAccounts: any[] = [];
    
    if (accountsResponse.body?.accounts) {
      accountsResponse.body.accounts.forEach((account: any) => {
        if (account.type === 'BANK' && account.status === 'ACTIVE') {
          const balance = account.balance || 0;
          totalBalance += balance;
          
          bankAccounts.push({
            id: account.accountID,
            name: account.name,
            code: account.code,
            balance: balance,
            currency: account.currencyCode || 'GBP',
            type: account.bankAccountType || 'BANK'
          });
        }
      });
    }
    
    console.log('Successfully fetched balance from Xero:', totalBalance);
    
    return NextResponse.json({
      totalBalance: totalBalance,
      currency: 'GBP',
      accounts: bankAccounts,
      count: bankAccounts.length,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Cash balance error:', error);
    return NextResponse.json({
      error: 'Failed to fetch cash balance',
      details: error.message
    }, { status: 500 });
  }
}
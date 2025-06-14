import { NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET() {
  try {
    console.log('[Account Transactions YTD] Starting fetch...');
    
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    const { client: xero, tenantId } = xeroData;
    
    // Get current year start date for YTD
    const currentYear = new Date().getFullYear();
    const fromDate = `${currentYear}-01-01`;
    const toDate = new Date().toISOString().split('T')[0];
    
    console.log(`[Account Transactions YTD] Fetching from ${fromDate} to ${toDate}`);
    
    // First get all accounts
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenantId,
      undefined,
      undefined,
      'Code ASC'
    );
    
    const accounts = accountsResponse.body.accounts || [];
    const accountsWithYTD = [];
    
    // For each account, get the actual balance and transactions
    for (const account of accounts) {
      try {
        // Get account details with balance
        const accountResponse = await xero.accountingApi.getAccount(
          tenantId,
          account.accountID!
        );
        
        const accountDetail = accountResponse.body.accounts?.[0];
        
        if (accountDetail) {
          // Log VAT and system accounts
          if (account.code === '820' || account.code === '825' || account.name?.includes('VAT')) {
            console.log(`[Account Transactions YTD] ${account.name} (${account.code}):`, {
              type: account.type,
              systemAccount: account.systemAccount,
              balance: (accountDetail as any).balance,
              status: account.status
            });
          }
          
          accountsWithYTD.push({
            accountID: account.accountID,
            code: account.code,
            name: account.name,
            type: account.type,
            balance: (accountDetail as any).balance || 0,
            systemAccount: account.systemAccount,
            status: account.status
          });
        }
      } catch (error) {
        console.error(`[Account Transactions YTD] Error fetching account ${account.code}:`, error);
      }
    }
    
    // Find and log VAT accounts
    const vatAccounts = accountsWithYTD.filter(a => 
      a.code === '820' || 
      a.code === '825' || 
      a.name?.includes('VAT')
    );
    
    console.log('[Account Transactions YTD] VAT Accounts found:', vatAccounts.length);
    vatAccounts.forEach(vat => {
      console.log(`  - ${vat.name} (${vat.code}): Balance = ${vat.balance}`);
    });
    
    return NextResponse.json({
      accounts: accountsWithYTD,
      totalAccounts: accountsWithYTD.length,
      dateRange: { fromDate, toDate }
    });
    
  } catch (error: any) {
    console.error('[Account Transactions YTD] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch account balances',
      message: error.message 
    }, { status: 500 });
  }
}
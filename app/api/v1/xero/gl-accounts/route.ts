import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Fetching GL accounts from Xero...');
    
    // Get all accounts (Chart of Accounts)
    const response = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'UpdatedDateUTC DESC'
    );

    const accounts = response.body.accounts || [];
    
    console.log(`Found ${accounts.length} GL accounts`);

    // Transform and categorize accounts
    const accountsByType = accounts.reduce((acc, account) => {
      const type = account.type?.toString() || 'OTHER';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push({
        code: account.code,
        name: account.name,
        type: account.type,
        status: account.status,
        description: account.description,
        systemAccount: account.systemAccount,
        enablePaymentsToAccount: account.enablePaymentsToAccount,
        showInExpenseClaims: account.showInExpenseClaims,
        class: account._class,
        reportingCode: account.reportingCode,
        reportingCodeName: account.reportingCodeName
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Get commonly used expense accounts
    const expenseAccounts = accounts
      .filter(acc => 
        acc.type?.toString() === 'EXPENSE' || 
        acc.type?.toString() === 'DIRECTCOSTS' ||
        acc.type?.toString() === 'OVERHEADS'
      )
      .map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type
      }));

    return NextResponse.json({
      total: accounts.length,
      accountsByType,
      expenseAccounts,
      allAccounts: accounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type,
        status: acc.status
      }))
    });
    
  } catch (error: any) {
    console.error('Error fetching GL accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch GL accounts',
      message: error.message
    }, { status: 500 });
  }
}
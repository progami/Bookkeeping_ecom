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
    
    // Get all GL accounts from Xero
    const response = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'Code ASC'
    );
    
    const accounts = response.body.accounts || [];
    
    // Group by type and show codes
    const expenseAccounts = accounts
      .filter(acc => (acc as any).type === 'EXPENSE' || (acc as any).type === 'OVERHEADS' || (acc as any).type === 'DIRECTCOSTS')
      .map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type
      }));
    
    const revenueAccounts = accounts
      .filter(acc => (acc as any).type === 'REVENUE' || (acc as any).type === 'SALES')
      .map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type
      }));
    
    // Find specific codes
    const code400 = accounts.find(acc => acc.code === '400');
    const code500 = accounts.find(acc => acc.code === '500');
    const code620 = accounts.find(acc => acc.code === '620');
    
    return NextResponse.json({
      totalAccounts: accounts.length,
      expenseAccountsCount: expenseAccounts.length,
      revenueAccountsCount: revenueAccounts.length,
      sampleExpenseAccounts: expenseAccounts.slice(0, 10),
      sampleRevenueAccounts: revenueAccounts.slice(0, 10),
      specificCodes: {
        '400': code400 ? { name: code400.name, type: code400.type } : 'not found',
        '500': code500 ? { name: code500.name, type: code500.type } : 'not found',
        '620': code620 ? { name: code620.name, type: code620.type } : 'not found'
      }
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
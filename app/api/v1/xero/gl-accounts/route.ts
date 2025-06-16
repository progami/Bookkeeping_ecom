import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '500');
    const offset = (page - 1) * pageSize;
    
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Fetching GL accounts from Xero...');
    
    // Get accounts (Chart of Accounts)
    // Note: Xero's getAccounts API doesn't support pagination directly
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

    // Implement manual pagination since Xero API doesn't support it
    const paginatedAccounts = accounts.slice(offset, offset + pageSize);
    const totalAccounts = accounts.length;
    const totalPages = Math.ceil(totalAccounts / pageSize);
    
    return NextResponse.json({
      accounts: paginatedAccounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        type: acc.type,
        status: acc.status
      })),
      accountsByType,
      expenseAccounts,
      pagination: {
        page,
        pageSize,
        totalAccounts,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching GL accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch GL accounts',
      message: error.message
    }, { status: 500 });
  }
}
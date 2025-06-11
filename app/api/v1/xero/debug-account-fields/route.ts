import { NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET() {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get a few accounts to inspect what fields Xero provides
    const response = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Status=="ACTIVE"',
      'Code ASC'
    );
    
    const accounts = response.body.accounts || [];
    
    // Take first 3 accounts and show all their fields
    const sampleAccounts = accounts.slice(0, 3).map(acc => {
      return {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        class: acc._class,
        hasClass: acc.hasOwnProperty('_class'),
        classValue: acc._class === undefined ? 'undefined' : acc._class === null ? 'null' : acc._class,
        allFields: Object.keys(acc),
        // Check if Xero provides any other classification field
        taxType: acc.taxType,
        systemAccount: acc.systemAccount,
        reportingCode: acc.reportingCode,
        reportingCodeName: acc.reportingCodeName
      };
    });
    
    return NextResponse.json({
      message: 'Debug: Account fields from Xero',
      totalAccounts: accounts.length,
      sampleAccounts,
      // Check if ANY account has a class value
      anyHaveClass: accounts.some(acc => acc._class !== null && acc._class !== undefined),
      classValues: [...new Set(accounts.map(acc => acc._class).filter(c => c !== null && c !== undefined))]
    });
    
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: 'Failed to debug accounts',
      details: error.message
    }, { status: 500 });
  }
}
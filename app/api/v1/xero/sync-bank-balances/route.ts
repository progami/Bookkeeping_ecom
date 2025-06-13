import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';

export async function POST(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Syncing bank account balances from Xero...');
    
    // Get all bank accounts from Xero
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"',
      undefined,
      undefined
    );
    
    const xeroAccounts = accountsResponse.body.accounts || [];
    console.log(`Found ${xeroAccounts.length} bank accounts in Xero`);
    
    let updatedCount = 0;
    const results = [];
    
    for (const xeroAccount of xeroAccounts) {
      if (!xeroAccount.accountID) continue;
      
      try {
        // Update or create bank account with current balance
        const updated = await prisma.bankAccount.upsert({
          where: { xeroAccountId: xeroAccount.accountID },
          update: {
            name: xeroAccount.name || '',
            code: xeroAccount.code || null,
            currencyCode: xeroAccount.currencyCode?.toString() || null,
            status: xeroAccount.status?.toString() || null,
            balance: 0, // Balance needs to be retrieved separately from reports
            balanceLastUpdated: new Date(),
            updatedAt: new Date()
          },
          create: {
            xeroAccountId: xeroAccount.accountID,
            name: xeroAccount.name || '',
            code: xeroAccount.code || null,
            currencyCode: xeroAccount.currencyCode?.toString() || null,
            status: xeroAccount.status?.toString() || null,
            bankName: xeroAccount.bankAccountType?.toString() || null,
            balance: 0, // Balance needs to be retrieved separately from reports
            balanceLastUpdated: new Date()
          }
        });
        
        results.push({
          name: updated.name,
          balance: updated.balance,
          currency: updated.currencyCode || 'GBP'
        });
        
        updatedCount++;
        console.log(`Updated ${updated.name}: ${updated.currencyCode} ${updated.balance}`);
        
      } catch (error) {
        console.error(`Error updating account ${xeroAccount.name}:`, error);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} bank account balances`,
      accounts: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Bank balance sync error:', error);
    return NextResponse.json({
      error: 'Failed to sync bank balances',
      details: error.message
    }, { status: 500 });
  }
}
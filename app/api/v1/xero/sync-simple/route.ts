import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: 'simple_test',
      status: 'in_progress',
      startedAt: new Date()
    }
  });

  try {
    console.log('[SYNC-SIMPLE] Starting simple sync...');
    
    const xero = await getXeroClient();
    
    if (!xero) {
      throw new Error('Not connected to Xero');
    }
    
    console.log('[SYNC-SIMPLE] Updating tenants...');
    await xero.updateTenants();
    
    if (!xero.tenants || xero.tenants.length === 0) {
      throw new Error('No Xero tenants found. Please reconnect to Xero.');
    }
    
    const tenant = xero.tenants[0];
    console.log('[SYNC-SIMPLE] Tenant:', tenant.tenantName);
    
    // Try to sync just bank accounts as a test
    console.log('[SYNC-SIMPLE] Fetching bank accounts...');
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    const bankAccounts = accountsResponse.body.accounts || [];
    console.log(`[SYNC-SIMPLE] Found ${bankAccounts.length} bank accounts`);
    
    // Sync bank accounts to database
    let syncedCount = 0;
    for (const account of bankAccounts) {
      if (account.accountID && account.name) {
        await prisma.bankAccount.upsert({
          where: { xeroAccountId: account.accountID },
          create: {
            xeroAccountId: account.accountID,
            code: account.code || '',
            name: account.name,
            status: account.status || 'ACTIVE',
            currencyCode: account.currencyCode || 'GBP',
            balance: 0,
            balanceLastUpdated: new Date()
          },
          update: {
            name: account.name,
            code: account.code || '',
            status: account.status || 'ACTIVE',
            currencyCode: account.currencyCode || 'GBP',
            balanceLastUpdated: new Date()
          }
        });
        syncedCount++;
      }
    }
    
    console.log(`[SYNC-SIMPLE] Synced ${syncedCount} bank accounts`);
    
    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated: syncedCount,
        recordsUpdated: 0
      }
    });
    
    return NextResponse.json({
      success: true,
      bankAccountsSynced: syncedCount
    });
    
  } catch (error: any) {
    console.error('[SYNC-SIMPLE] Error:', error);
    
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      }
    });
    
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message
    }, { status: 500 });
  }
}
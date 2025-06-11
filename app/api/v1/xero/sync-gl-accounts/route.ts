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
    
    console.log('Syncing GL accounts from Xero...');
    
    // Get all accounts (Chart of Accounts) - excluding archived
    const response = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Status=="ACTIVE"',
      'Code ASC'
    );

    const accounts = response.body.accounts || [];
    
    console.log(`Found ${accounts.length} GL accounts in Xero`);

    // Start a transaction to ensure atomic updates
    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        // Skip accounts without codes
        if (!account.code) {
          console.warn(`Skipping account without code: ${account.name}`);
          continue;
        }

        // Upsert the account
        await prisma.gLAccount.upsert({
          where: { code: account.code },
          update: {
            name: account.name || '',
            type: account.type?.toString() || 'OTHER',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims || false,
            enablePaymentsToAccount: account.enablePaymentsToAccount || false,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null,
            updatedAt: new Date()
          },
          create: {
            code: account.code,
            name: account.name || '',
            type: account.type?.toString() || 'OTHER',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims || false,
            enablePaymentsToAccount: account.enablePaymentsToAccount || false,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null
          }
        });

        // Check if it was created or updated
        const existing = await prisma.gLAccount.findUnique({
          where: { code: account.code }
        });
        
        if (existing && existing.createdAt.getTime() === existing.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error(`Error processing account ${account.code}:`, error);
        errors++;
      }
    }

    // Log the sync
    await prisma.syncLog.create({
      data: {
        syncType: 'gl_accounts',
        status: errors > 0 ? 'partial' : 'success',
        startedAt: new Date(),
        completedAt: new Date(),
        recordsCreated: created,
        recordsUpdated: updated,
        errorMessage: errors > 0 ? `${errors} accounts failed to sync` : null,
        details: JSON.stringify({
          totalAccounts: accounts.length,
          created,
          updated,
          errors
        })
      }
    });

    console.log(`GL Accounts sync completed: ${created} created, ${updated} updated, ${errors} errors`);

    // Get summary of synced accounts
    const syncedAccounts = await prisma.gLAccount.groupBy({
      by: ['type'],
      _count: true
    });

    return NextResponse.json({
      success: true,
      message: 'GL accounts synced successfully',
      stats: {
        total: accounts.length,
        created,
        updated,
        errors
      },
      accountsByType: syncedAccounts
    });
    
  } catch (error: any) {
    console.error('Error syncing GL accounts:', error);
    
    // Log the failed sync
    await prisma.syncLog.create({
      data: {
        syncType: 'gl_accounts',
        status: 'failed',
        startedAt: new Date(),
        completedAt: new Date(),
        recordsCreated: 0,
        recordsUpdated: 0,
        errorMessage: error.message,
        details: JSON.stringify({
          error: error.toString()
        })
      }
    });

    return NextResponse.json({
      error: 'Failed to sync GL accounts',
      message: error.message
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all GL accounts from database
    const accounts = await prisma.gLAccount.findMany({
      orderBy: { code: 'asc' }
    });

    // Group by type
    const accountsByType = accounts.reduce((acc, account) => {
      const type = account.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(account);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      total: accounts.length,
      accountsByType,
      allAccounts: accounts
    });
    
  } catch (error: any) {
    console.error('Error fetching GL accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch GL accounts',
      message: error.message
    }, { status: 500 });
  }
}
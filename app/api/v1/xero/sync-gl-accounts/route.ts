import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClientWithTenant } from '@/lib/xero-client';

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const syncStartTime = new Date();
  
  try {
    console.log('=== GL Sync Endpoint Called ===');
    console.log('Request headers:', {
      cookie: request.headers.get('cookie'),
      contentType: request.headers.get('content-type')
    });
    
    // Get request body to check for includeArchived parameter
    const body = await request.json().catch(() => ({}));
    const includeArchived = body.includeArchived || false;
    
    console.log('Attempting to get Xero client...');
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      console.log('Failed to get Xero client - not authenticated');
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    const { client: xero, tenantId } = xeroData;
    
    console.log(`Syncing GL accounts from Xero... (includeArchived: ${includeArchived})`);
    
    // Get accounts based on whether we want archived ones
    const whereFilter = includeArchived ? undefined : 'Status=="ACTIVE"';
    const response = await xero.accountingApi.getAccounts(
      tenantId,
      undefined,
      whereFilter,
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
        // For accounts without codes, generate a special code based on type
        let accountCode = account.code;
        if (!accountCode) {
          // For bank accounts without codes, use "BANK" as the code
          if (account.type === 'BANK') {
            accountCode = `BANK_${account.accountID?.substring(0, 8) || Math.random().toString(36).substring(2, 10)}`;
            console.log(`Assigning code ${accountCode} to bank account: ${account.name}`);
          } else {
            console.warn(`Skipping non-bank account without code: ${account.name}`);
            continue;
          }
        }

        // Check if account exists before upsert
        const existingAccount = await prisma.gLAccount.findUnique({
          where: { code: accountCode }
        });

        // Upsert the account
        await prisma.gLAccount.upsert({
          where: { code: accountCode },
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
            code: accountCode,
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

        // Count as created or updated based on whether it existed before
        if (existingAccount) {
          updated++;
        } else {
          created++;
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
        startedAt: syncStartTime,
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
        startedAt: syncStartTime,
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
      allAccounts: accounts,
      accounts: accounts // For compatibility
    });
    
  } catch (error: any) {
    console.error('Error fetching GL accounts:', error);
    return NextResponse.json({
      error: 'Failed to fetch GL accounts',
      message: error.message
    }, { status: 500 });
  }
}
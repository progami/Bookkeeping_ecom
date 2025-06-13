import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logs.push(msg);
  };

  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    log(`Starting bulletproof sync for ${tenant.tenantName}...`);
    
    // Step 1: Clear and recreate account mappings
    log('Step 1: Syncing bank accounts...');
    const accountsResp = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    const accounts = accountsResp.body.accounts || [];
    
    const accountMap = new Map();
    for (const acc of accounts) {
      if (!acc.accountID) continue;
      
      const dbAcc = await prisma.bankAccount.upsert({
        where: { xeroAccountId: acc.accountID },
        update: {
          name: acc.name || '',
          currencyCode: acc.currencyCode?.toString() || null,
          updatedAt: new Date()
        },
        create: {
          xeroAccountId: acc.accountID,
          name: acc.name || '',
          currencyCode: acc.currencyCode?.toString() || null
        }
      });
      accountMap.set(acc.accountID, dbAcc.id);
      log(`  Account: ${acc.name} (${acc.currencyCode}) -> DB ID: ${dbAcc.id}`);
    }
    log(`Synced ${accounts.length} bank accounts`);
    
    // Step 2: Get ALL transactions in one call
    log('\nStep 2: Fetching ALL transactions from Xero...');
    const response = await xero.accountingApi.getBankTransactions(tenant.tenantId);
    const allTransactions = response.body.bankTransactions || [];
    log(`Received ${allTransactions.length} transactions from Xero API`);
    
    // Step 3: Process in batches to avoid timeouts
    const BATCH_SIZE = 100;
    let saved = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    log('\nStep 3: Saving transactions to database...');
    
    for (let i = 0; i < allTransactions.length; i += BATCH_SIZE) {
      const batch = allTransactions.slice(i, i + BATCH_SIZE);
      const batchResults = { saved: 0, updated: 0, skipped: 0, errors: 0 };
      
      // Process batch in parallel
      const promises = batch.map(async (tx) => {
        try {
          if (!tx.bankTransactionID) {
            batchResults.skipped++;
            return;
          }
          
          if (!tx.bankAccount?.accountID) {
            log(`  Warning: Transaction ${tx.bankTransactionID} has no bank account`);
            batchResults.skipped++;
            return;
          }
          
          const dbAccountId = accountMap.get(tx.bankAccount.accountID);
          if (!dbAccountId) {
            log(`  Warning: No DB mapping for account ${tx.bankAccount.accountID}`);
            batchResults.skipped++;
            return;
          }
          
          // Check if exists
          const existing = await prisma.bankTransaction.findUnique({
            where: { xeroTransactionId: tx.bankTransactionID }
          });
          
          // Prepare data
          const txData = {
            bankAccountId: dbAccountId,
            date: new Date(tx.date || new Date()),
            amount: tx.total || 0,
            currencyCode: tx.currencyCode?.toString() || null,
            type: tx.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
            status: tx.status?.toString() || 'AUTHORISED',
            isReconciled: tx.isReconciled || false,
            reference: tx.reference || null,
            description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || 'No description',
            contactName: tx.contact?.name || null,
            lineItems: tx.lineItems ? JSON.stringify(tx.lineItems) : null,
            hasAttachments: tx.hasAttachments || false,
            lastSyncedAt: new Date()
          };
          
          if (existing) {
            await prisma.bankTransaction.update({
              where: { xeroTransactionId: tx.bankTransactionID },
              data: txData
            });
            batchResults.updated++;
          } else {
            await prisma.bankTransaction.create({
              data: {
                xeroTransactionId: tx.bankTransactionID,
                ...txData
              }
            });
            batchResults.saved++;
          }
        } catch (error: any) {
          log(`  Error processing ${tx.bankTransactionID}: ${error.message}`);
          batchResults.errors++;
        }
      });
      
      // Wait for batch to complete
      await Promise.all(promises);
      
      saved += batchResults.saved;
      updated += batchResults.updated;
      skipped += batchResults.skipped;
      errors += batchResults.errors;
      
      log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: Saved ${batchResults.saved}, Updated ${batchResults.updated}, Skipped ${batchResults.skipped}, Errors ${batchResults.errors}`);
    }
    
    // Step 4: Verify results
    log('\nStep 4: Verifying results...');
    const totalInDb = await prisma.bankTransaction.count();
    const accountStats = await prisma.bankTransaction.groupBy({
      by: ['bankAccountId'],
      _count: true
    });
    
    const detailedStats = [];
    for (const stat of accountStats) {
      const account = await prisma.bankAccount.findUnique({
        where: { id: stat.bankAccountId }
      });
      if (account) {
        detailedStats.push({
          account: account.name,
          currency: account.currencyCode,
          count: stat._count
        });
        log(`  ${account.name}: ${stat._count} transactions`);
      }
    }
    
    const result = {
      success: true,
      summary: {
        receivedFromXero: allTransactions.length,
        saved,
        updated,
        skipped,
        errors,
        totalInDatabase: totalInDb
      },
      accountBreakdown: detailedStats.sort((a, b) => b.count - a.count),
      logs
    };
    
    log(`\nFINAL RESULT: ${totalInDb} total transactions in database`);
    
    // Create sync log
    await prisma.syncLog.create({
      data: {
        syncType: 'bulletproof_sync',
        status: 'success',
        startedAt: new Date().toISOString().split('T')[0],
        completedAt: new Date().toISOString().split('T')[0],
        recordsCreated: saved,
        recordsUpdated: updated,
        details: JSON.stringify(result)
      }
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    log(`FATAL ERROR: ${error.message}`);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
      logs
    }, { status: 500 });
  }
}
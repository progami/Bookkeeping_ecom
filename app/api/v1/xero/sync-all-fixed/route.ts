import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log(`Starting comprehensive sync for ${tenant.tenantName}...`);
    
    // Get and save all bank accounts
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
    }
    
    console.log(`Synced ${accounts.length} bank accounts`);
    
    // First, reset all transactions to reconciled
    await prisma.bankTransaction.updateMany({
      where: {},
      data: { isReconciled: true }
    });
    console.log('Reset all transactions to reconciled');
    
    // Now fetch specifically unreconciled transactions
    console.log('Fetching unreconciled transactions from Xero...');
    const unreconciledResponse = await xero.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      'IsReconciled==false',
      undefined,
      undefined,
      undefined
    );
    const unreconciledTxs = unreconciledResponse.body.bankTransactions || [];
    console.log(`Found ${unreconciledTxs.length} unreconciled transactions`);
    
    // Update these as unreconciled
    for (const tx of unreconciledTxs) {
      if (tx.bankTransactionID) {
        await prisma.bankTransaction.update({
          where: { xeroTransactionId: tx.bankTransactionID },
          data: { isReconciled: false }
        }).catch(() => {
          console.log(`Transaction ${tx.bankTransactionID} not in database yet`);
        });
      }
    }
    
    // Now fetch ALL transactions
    console.log('Fetching ALL transactions in one request...');
    const response = await xero.accountingApi.getBankTransactions(tenant.tenantId);
    const allTransactions = response.body.bankTransactions || [];
    
    console.log(`Received ${allTransactions.length} transactions from Xero!`);
    
    // Save all transactions to database
    let saved = 0, updated = 0, errors = 0;
    
    for (const tx of allTransactions) {
      if (!tx.bankTransactionID || !tx.bankAccount?.accountID) continue;
      
      const dbAccountId = accountMap.get(tx.bankAccount.accountID);
      if (!dbAccountId) {
        console.log(`Skipping transaction - no account mapping for ${tx.bankAccount.accountID}`);
        continue;
      }
      
      // Debug first few transactions to see reconciliation values
      if (saved + updated < 5) {
        console.log(`Transaction ${saved + updated + 1} reconciliation:`, {
          id: tx.bankTransactionID,
          date: tx.date,
          isReconciled: tx.isReconciled,
          isReconciledType: typeof tx.isReconciled,
          isReconciledValue: JSON.stringify(tx.isReconciled),
          willSaveAs: tx.isReconciled === true
        });
      }
      
      try {
        const existing = await prisma.bankTransaction.findUnique({
          where: { xeroTransactionId: tx.bankTransactionID }
        });
        
        await prisma.bankTransaction.upsert({
          where: { xeroTransactionId: tx.bankTransactionID },
          update: {
            date: new Date(tx.date || new Date()),
            amount: tx.total || 0,
            currencyCode: tx.currencyCode?.toString() || null,
            type: tx.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
            status: tx.status?.toString() || 'AUTHORISED',
            isReconciled: unreconciledTxs.some(u => u.bankTransactionID === tx.bankTransactionID) ? false : true,
            reference: tx.reference || null,
            description: tx.lineItems?.[0]?.description || tx.reference || tx.contact?.name || 'Bank Transaction',
            contactName: tx.contact?.name || null,
            lineItems: tx.lineItems ? JSON.stringify(tx.lineItems) : null,
            hasAttachments: tx.hasAttachments || false,
            accountCode: tx.lineItems?.[0]?.accountCode || null,
            taxType: tx.lineItems?.[0]?.taxType || null,
            lastSyncedAt: new Date()
          },
          create: {
            xeroTransactionId: tx.bankTransactionID,
            bankAccountId: dbAccountId,
            date: new Date(tx.date || new Date()),
            amount: tx.total || 0,
            currencyCode: tx.currencyCode?.toString() || null,
            type: tx.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
            status: tx.status?.toString() || 'AUTHORISED',
            isReconciled: unreconciledTxs.some(u => u.bankTransactionID === tx.bankTransactionID) ? false : true,
            reference: tx.reference || null,
            description: tx.lineItems?.[0]?.description || tx.reference || tx.contact?.name || 'Bank Transaction',
            contactName: tx.contact?.name || null,
            lineItems: tx.lineItems ? JSON.stringify(tx.lineItems) : null,
            hasAttachments: tx.hasAttachments || false,
            accountCode: tx.lineItems?.[0]?.accountCode || null,
            taxType: tx.lineItems?.[0]?.taxType || null
          }
        });
        
        if (existing) {
          updated++;
        } else {
          saved++;
        }
        
        // Log progress every 100 transactions
        if ((saved + updated) % 100 === 0) {
          console.log(`Progress: ${saved + updated} / ${allTransactions.length} processed`);
        }
      } catch (error: any) {
        errors++;
        console.error(`Error saving transaction ${tx.bankTransactionID}: ${error.message}`);
      }
    }
    
    // Get final statistics
    const totalInDb = await prisma.bankTransaction.count();
    const accountStats = await prisma.bankTransaction.groupBy({
      by: ['bankAccountId'],
      _count: true
    });
    
    const detailedStats = await Promise.all(
      accountStats.map(async (stat) => {
        const account = await prisma.bankAccount.findUnique({
          where: { id: stat.bankAccountId }
        });
        return {
          account: account?.name || 'Unknown',
          currency: account?.currencyCode || 'Unknown',
          count: stat._count
        };
      })
    );
    
    const result = {
      success: true,
      summary: {
        receivedFromXero: allTransactions.length,
        saved,
        updated,
        errors,
        totalInDatabase: totalInDb
      },
      accountBreakdown: detailedStats
    };
    
    console.log('Sync complete!', result);
    
    // Create sync log
    await prisma.syncLog.create({
      data: {
        syncType: 'full_sync_fixed',
        status: 'success',
        startedAt: new Date(),
        completedAt: new Date(),
        recordsCreated: saved,
        recordsUpdated: updated,
        details: JSON.stringify(result)
      }
    });
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message
    }, { status: 500 });
  }
}
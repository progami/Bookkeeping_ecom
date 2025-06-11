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
    log(`Connected to: ${tenant.tenantName}`);
    
    // Get ALL accounts first
    const accountsResp = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    const accounts = accountsResp.body.accounts || [];
    log(`Found ${accounts.length} bank accounts`);
    
    // Save accounts
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
    
    // Try multiple strategies to get ALL transactions
    const allTxMap = new Map();
    
    // Strategy 1: Get transactions without ANY parameters (raw)
    log('\n=== Strategy 1: Raw fetch (no parameters) ===');
    try {
      let page = 1;
      let emptyPages = 0;
      while (page <= 50) {
        const resp = await xero.accountingApi.getBankTransactions(tenant.tenantId);
        const txs = resp.body.bankTransactions || [];
        log(`Page ${page}: ${txs.length} transactions`);
        
        if (txs.length === 0) {
          emptyPages++;
          if (emptyPages > 5) break;
        } else {
          emptyPages = 0;
          txs.forEach(tx => {
            if (tx.bankTransactionID) allTxMap.set(tx.bankTransactionID, tx);
          });
        }
        
        if (txs.length < 100) break;
        page++;
      }
    } catch (e: any) {
      log(`Strategy 1 error: ${e.message}`);
    }
    log(`Total after strategy 1: ${allTxMap.size} unique transactions`);
    
    // Strategy 2: Get by date range (last 5 years)
    log('\n=== Strategy 2: Date range (5 years) ===');
    try {
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      
      let page = 1;
      while (page <= 50) {
        const resp = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          `Date >= DateTime(${fiveYearsAgo.toISOString().split('T')[0]}T00:00:00)`,
          undefined,
          100,
          undefined,
          page
        );
        const txs = resp.body.bankTransactions || [];
        log(`Page ${page}: ${txs.length} transactions`);
        
        txs.forEach(tx => {
          if (tx.bankTransactionID) allTxMap.set(tx.bankTransactionID, tx);
        });
        
        if (txs.length < 100) break;
        page++;
      }
    } catch (e: any) {
      log(`Strategy 2 error: ${e.message}`);
    }
    log(`Total after strategy 2: ${allTxMap.size} unique transactions`);
    
    // Strategy 3: Get from each account
    log('\n=== Strategy 3: Per-account fetch ===');
    for (const account of accounts) {
      if (!account.accountID) continue;
      log(`\nFetching from ${account.name}...`);
      
      try {
        let page = 1;
        let accountTxCount = 0;
        while (page <= 20) {
          const resp = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined,
            `BankAccount.AccountID=Guid("${account.accountID}")`,
            undefined,
            100,
            undefined,
            page
          );
          const txs = resp.body.bankTransactions || [];
          
          if (txs.length === 0 && page > 1) break;
          
          txs.forEach(tx => {
            if (tx.bankTransactionID) {
              allTxMap.set(tx.bankTransactionID, tx);
              accountTxCount++;
            }
          });
          
          log(`  Page ${page}: ${txs.length} transactions`);
          if (txs.length < 100) break;
          page++;
        }
        log(`  Total for ${account.name}: ${accountTxCount} transactions`);
      } catch (e: any) {
        log(`  Error: ${e.message}`);
      }
    }
    log(`\nTotal after strategy 3: ${allTxMap.size} unique transactions`);
    
    // Strategy 4: Try with modified since (get all historical)
    log('\n=== Strategy 4: Modified since 2020 ===');
    try {
      const modifiedSince = new Date('2020-01-01');
      const resp = await xero.accountingApi.getBankTransactions(
        tenant.tenantId,
        modifiedSince,
        undefined,
        undefined,
        100
      );
      const txs = resp.body.bankTransactions || [];
      log(`Got ${txs.length} transactions modified since 2020`);
      txs.forEach(tx => {
        if (tx.bankTransactionID) allTxMap.set(tx.bankTransactionID, tx);
      });
    } catch (e: any) {
      log(`Strategy 4 error: ${e.message}`);
    }
    
    // Save all transactions to database
    log(`\n=== Saving ${allTxMap.size} transactions to database ===`);
    let saved = 0, updated = 0, errors = 0;
    
    for (const [id, tx] of allTxMap) {
      try {
        if (!tx.bankAccount?.accountID) continue;
        const dbAccountId = accountMap.get(tx.bankAccount.accountID);
        if (!dbAccountId) continue;
        
        const existing = await prisma.bankTransaction.findUnique({
          where: { xeroTransactionId: id }
        });
        
        await prisma.bankTransaction.upsert({
          where: { xeroTransactionId: id },
          update: {
            date: new Date(tx.date || new Date()),
            amount: tx.total || 0,
            isReconciled: tx.isReconciled || false,
            lastSyncedAt: new Date()
          },
          create: {
            xeroTransactionId: id,
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
            hasAttachments: tx.hasAttachments || false
          }
        });
        
        existing ? updated++ : saved++;
      } catch (e: any) {
        errors++;
      }
    }
    
    log(`\nSaved: ${saved}, Updated: ${updated}, Errors: ${errors}`);
    
    // Final count
    const finalCount = await prisma.bankTransaction.count();
    log(`\nTotal transactions in database: ${finalCount}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        foundInXero: allTxMap.size,
        saved,
        updated,
        errors,
        totalInDatabase: finalCount
      },
      logs
    });
    
  } catch (error: any) {
    logs.push(`FATAL ERROR: ${error.message}`);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
      logs
    }, { status: 500 });
  }
}
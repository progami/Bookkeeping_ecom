import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

// This endpoint manually syncs transactions with extensive logging
export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const log = (message: string, data?: any) => {
    const logEntry = `[${new Date().toISOString()}] ${message}`;
    logs.push(logEntry);
    if (data) {
      logs.push(`  Data: ${JSON.stringify(data, null, 2)}`);
    }
    console.log(logEntry, data || '');
  };

  try {
    log('Starting manual sync process...');
    
    const xero = await getXeroClient();
    if (!xero) {
      log('ERROR: Not connected to Xero');
      return NextResponse.json({ 
        error: 'Not connected to Xero',
        logs 
      }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    log('Connected to tenant', { name: tenant.tenantName, id: tenant.tenantId });
    
    // Step 1: Get ALL bank accounts
    log('Fetching bank accounts...');
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    const bankAccounts = accountsResponse.body.accounts || [];
    log(`Found ${bankAccounts.length} bank accounts`);
    
    // Update accounts in DB
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      await prisma.bankAccount.upsert({
        where: { xeroAccountId: account.accountID },
        update: {
          name: account.name || '',
          code: account.code || null,
          currencyCode: account.currencyCode?.toString() || null,
          status: account.status?.toString() || null,
          updatedAt: new Date()
        },
        create: {
          xeroAccountId: account.accountID,
          name: account.name || '',
          code: account.code || null,
          currencyCode: account.currencyCode?.toString() || null,
          status: account.status?.toString() || null
        }
      });
    }
    
    // Step 2: Try multiple strategies to fetch ALL transactions
    let allTransactions = new Map(); // Use Map to avoid duplicates
    
    // Strategy 1: Fetch without any filters (all pages)
    log('Strategy 1: Fetching ALL transactions without filters...');
    let page = 1;
    let totalPages = 0;
    
    while (page <= 100) { // Safety limit
      try {
        log(`Fetching page ${page}...`);
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined, // If-Modified-Since
          undefined, // where
          undefined, // order
          100, // pageSize
          undefined, // unitdp
          page // page number
        );
        
        const transactions = response.body.bankTransactions || [];
        log(`Page ${page}: ${transactions.length} transactions`);
        
        if (transactions.length === 0) {
          if (page === 1) {
            log('Page 1 is empty, trying page 2...');
            page++;
            continue;
          } else if (totalPages < 3) {
            // Keep trying a few more pages
            totalPages++;
            page++;
            continue;
          } else {
            log('No more transactions found');
            break;
          }
        }
        
        // Add transactions to our map
        for (const tx of transactions) {
          if (tx.bankTransactionID) {
            allTransactions.set(tx.bankTransactionID, tx);
          }
        }
        
        totalPages = 0; // Reset empty page counter
        page++;
        
        // If we got less than pageSize, we might be at the end
        if (transactions.length < 100 && page > 2) {
          log('Reached end of transactions');
          break;
        }
      } catch (error: any) {
        log(`Error on page ${page}: ${error.message}`);
        break;
      }
    }
    
    log(`Strategy 1 complete: ${allTransactions.size} unique transactions`);
    
    // Strategy 2: Fetch by date range (last 2 years)
    log('Strategy 2: Fetching by date range...');
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    try {
      const response = await xero.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined,
        `Date >= DateTime(${twoYearsAgo.toISOString().split('T')[0]}T00:00:00)`,
        'Date DESC',
        100
      );
      
      const transactions = response.body.bankTransactions || [];
      log(`Date range fetch: ${transactions.length} transactions`);
      
      for (const tx of transactions) {
        if (tx.bankTransactionID) {
          allTransactions.set(tx.bankTransactionID, tx);
        }
      }
    } catch (error: any) {
      log(`Date range error: ${error.message}`);
    }
    
    log(`After Strategy 2: ${allTransactions.size} unique transactions`);
    
    // Strategy 3: Fetch from each account individually
    log('Strategy 3: Fetching from each account...');
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      log(`Fetching from ${account.name} (${account.currencyCode})...`);
      let accountPage = 1;
      let accountTransactions = 0;
      
      while (accountPage <= 10) { // Limit pages per account
        try {
          const response = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined,
            `BankAccount.AccountID=Guid("${account.accountID}")`,
            'Date DESC',
            100,
            undefined,
            accountPage
          );
          
          const transactions = response.body.bankTransactions || [];
          log(`  Page ${accountPage}: ${transactions.length} transactions`);
          
          if (transactions.length === 0) {
            break;
          }
          
          for (const tx of transactions) {
            if (tx.bankTransactionID) {
              allTransactions.set(tx.bankTransactionID, tx);
              accountTransactions++;
            }
          }
          
          accountPage++;
          
          if (transactions.length < 100) {
            break;
          }
        } catch (error: any) {
          log(`  Error: ${error.message}`);
          break;
        }
      }
      
      log(`  Total for ${account.name}: ${accountTransactions} transactions`);
    }
    
    log(`Total unique transactions found: ${allTransactions.size}`);
    
    // Step 3: Save all transactions to database
    log('Saving transactions to database...');
    let saved = 0;
    let updated = 0;
    let errors = 0;
    
    const dbAccounts = await prisma.bankAccount.findMany();
    const accountMap = new Map(dbAccounts.map(a => [a.xeroAccountId, a.id]));
    
    for (const [id, tx] of allTransactions) {
      try {
        if (!tx.bankAccount?.accountID) continue;
        
        const dbAccountId = accountMap.get(tx.bankAccount.accountID);
        if (!dbAccountId) {
          log(`Skipping transaction - no account mapping for ${tx.bankAccount.accountID}`);
          continue;
        }
        
        const existing = await prisma.bankTransaction.findUnique({
          where: { xeroTransactionId: id }
        });
        
        await prisma.bankTransaction.upsert({
          where: { xeroTransactionId: id },
          update: {
            bankAccountId: dbAccountId,
            date: new Date(tx.date || new Date()),
            amount: tx.total || 0,
            currencyCode: tx.currencyCode?.toString() || null,
            type: tx.type?.toString() === 'RECEIVE' ? 'RECEIVE' : 'SPEND',
            status: tx.status?.toString() || 'AUTHORISED',
            isReconciled: tx.isReconciled || false,
            reference: tx.reference || null,
            description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
            contactName: tx.contact?.name || null,
            lineItems: tx.lineItems ? JSON.stringify(tx.lineItems) : null,
            hasAttachments: tx.hasAttachments || false,
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
            description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
            contactName: tx.contact?.name || null,
            lineItems: tx.lineItems ? JSON.stringify(tx.lineItems) : null,
            hasAttachments: tx.hasAttachments || false
          }
        });
        
        if (existing) {
          updated++;
        } else {
          saved++;
        }
      } catch (error: any) {
        errors++;
        log(`Error saving transaction ${id}: ${error.message}`);
      }
    }
    
    log(`Database update complete: ${saved} created, ${updated} updated, ${errors} errors`);
    
    // Get final counts
    const finalCounts = await prisma.bankTransaction.groupBy({
      by: ['bankAccountId'],
      _count: true
    });
    
    const accountCounts = await Promise.all(
      finalCounts.map(async (fc) => {
        const account = await prisma.bankAccount.findUnique({
          where: { id: fc.bankAccountId }
        });
        return {
          account: account?.name || 'Unknown',
          currency: account?.currencyCode || 'Unknown',
          count: fc._count
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      summary: {
        totalTransactionsFound: allTransactions.size,
        saved,
        updated,
        errors,
        accountBreakdown: accountCounts
      },
      logs
    });
    
  } catch (error: any) {
    log(`FATAL ERROR: ${error.message}`);
    return NextResponse.json({
      error: 'Manual sync failed',
      message: error.message,
      logs
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { BankTransaction } from 'xero-node';

export async function POST(request: NextRequest) {
  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: 'full_sync_all',
      status: 'in_progress',
      startedAt: new Date()
    }
  });

  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      throw new Error('Not connected to Xero');
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Starting FULL sync for ALL transactions...');
    
    // First sync bank accounts
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    const bankAccounts = accountsResponse.body.accounts || [];
    const accountMap = new Map();
    
    // Create account map
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      const dbAccount = await prisma.bankAccount.upsert({
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
      
      accountMap.set(account.accountID, dbAccount.id);
    }
    
    console.log(`Synced ${bankAccounts.length} bank accounts`);
    
    // Now fetch ALL transactions without account filter
    let allTransactions = 0;
    let page = 1;
    let hasMorePages = true;
    let consecutiveEmptyPages = 0;
    let createdTransactions = 0;
    let updatedTransactions = 0;
    
    console.log('Fetching ALL bank transactions...');
    
    while (hasMorePages && page <= 200) { // Increased to 200 pages
      try {
        console.log(`Fetching page ${page}...`);
        
        // Get ALL transactions, no filter, no order
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined, // If-Modified-Since
          undefined, // NO WHERE FILTER - get everything
          undefined, // NO ORDER - just get raw data
          100, // Page size
          undefined, // unitdp
          page // Page number
        );
        
        const transactions = response.body.bankTransactions || [];
        console.log(`Page ${page}: Found ${transactions.length} transactions`);
        
        if (transactions.length === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 5) {
            console.log('5 consecutive empty pages, stopping...');
            break;
          }
        } else {
          consecutiveEmptyPages = 0;
          
          // Process transactions
          for (const tx of transactions) {
            if (!tx.bankTransactionID || !tx.bankAccount?.accountID) continue;
            
            const dbAccountId = accountMap.get(tx.bankAccount.accountID);
            if (!dbAccountId) {
              console.log(`Skipping transaction - no account mapping for ${tx.bankAccount.accountID}`);
              continue;
            }
            
            const existing = await prisma.bankTransaction.findUnique({
              where: { xeroTransactionId: tx.bankTransactionID }
            });
            
            await prisma.bankTransaction.upsert({
              where: { xeroTransactionId: tx.bankTransactionID },
              update: {
                bankAccountId: dbAccountId,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
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
                xeroTransactionId: tx.bankTransactionID,
                bankAccountId: dbAccountId,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
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
              updatedTransactions++;
            } else {
              createdTransactions++;
            }
            allTransactions++;
          }
        }
        
        page++;
        
        // Also try to detect if we're at the end
        if (transactions.length < 100) {
          console.log(`Page ${page - 1} had less than 100 transactions (${transactions.length}), might be last page`);
        }
      } catch (pageError: any) {
        console.error(`Error on page ${page}:`, pageError.message);
        consecutiveEmptyPages++;
      }
    }
    
    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date().toISOString().split('T')[0],
        recordsCreated: createdTransactions,
        recordsUpdated: updatedTransactions,
        details: JSON.stringify({
          totalTransactions: allTransactions,
          pagesProcessed: page - 1,
          accounts: bankAccounts.length
        })
      }
    });
    
    console.log('\nSync completed!');
    console.log(`Total transactions: ${allTransactions}`);
    console.log(`Created: ${createdTransactions}, Updated: ${updatedTransactions}`);
    console.log(`Pages processed: ${page - 1}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        accounts: bankAccounts.length,
        transactions: allTransactions,
        created: createdTransactions,
        updated: updatedTransactions,
        pagesProcessed: page - 1
      }
    });
    
  } catch (error: any) {
    console.error('Sync error:', error);
    
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date().toISOString().split('T')[0],
        errorMessage: error.message
      }
    });
    
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message
    }, { status: 500 });
  }
}
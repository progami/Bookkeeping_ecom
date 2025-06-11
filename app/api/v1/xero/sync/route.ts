import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';
import { BankTransaction } from 'xero-node';

export async function POST(request: NextRequest) {
  const syncLog = await prisma.syncLog.create({
    data: {
      syncType: 'full_sync',
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
    
    console.log('Starting full sync for tenant:', tenant.tenantName);
    
    let totalAccounts = 0;
    let totalTransactions = 0;
    let createdTransactions = 0;
    let updatedTransactions = 0;
    
    // Step 1: Sync all bank accounts
    console.log('Fetching bank accounts...');
    const accountsResponse = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    
    const bankAccounts = accountsResponse.body.accounts || [];
    console.log(`Found ${bankAccounts.length} bank accounts`);
    
    // Upsert bank accounts
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      await prisma.bankAccount.upsert({
        where: { xeroAccountId: account.accountID },
        update: {
          name: account.name || '',
          code: account.code || null,
          currencyCode: account.currencyCode?.toString() || null,
          status: account.status?.toString() || null,
          bankName: account.bankAccountType?.toString() || null,
          accountNumber: account.bankAccountNumber || null,
          updatedAt: new Date()
        },
        create: {
          xeroAccountId: account.accountID,
          name: account.name || '',
          code: account.code || null,
          currencyCode: account.currencyCode?.toString() || null,
          status: account.status?.toString() || null,
          bankName: account.bankAccountType?.toString() || null,
          accountNumber: account.bankAccountNumber || null
        }
      });
      totalAccounts++;
    }
    
    console.log(`Synced ${totalAccounts} bank accounts`);
    
    // Step 2: Fetch transactions for EACH bank account
    for (const account of bankAccounts) {
      if (!account.accountID) continue;
      
      console.log(`\nFetching transactions for ${account.name} (${account.currencyCode})...`);
      
      const dbAccount = await prisma.bankAccount.findUnique({
        where: { xeroAccountId: account.accountID }
      });
      
      if (!dbAccount) continue;
      
      let accountTransactions = 0;
      let page = 1;
      let hasMorePages = true;
      let emptyPageCount = 0;
      
      // Fetch all pages of transactions for this account
      while (hasMorePages && page <= 100) { // Increased page limit to 100
        try {
          console.log(`  Fetching page ${page} for ${account.name}...`);
          const response = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined, // If-Modified-Since
            `BankAccount.AccountID=Guid("${account.accountID}")`, // Filter by account
            undefined, // Remove order to see if it helps
            100, // Page size
            undefined, // unitdp
            page // Page number
          );
          
          const transactions = response.body.bankTransactions || [];
          console.log(`  Page ${page}: ${transactions.length} transactions`);
          
          if (transactions.length === 0) {
            emptyPageCount++;
            // Continue checking MANY more pages even if we hit empty pages
            if (emptyPageCount >= 10) { // Increased from 3 to 10
              console.log(`  Stopping after ${emptyPageCount} empty pages`);
              hasMorePages = false;
              break;
            }
          } else {
            emptyPageCount = 0; // Reset empty page counter
          }
          
          // Process each transaction
          for (const tx of transactions) {
            if (!tx.bankTransactionID) continue;
            
            // Prepare line items as JSON string
            const lineItemsJson = tx.lineItems ? JSON.stringify(tx.lineItems) : null;
            
            // Upsert transaction
            const existing = await prisma.bankTransaction.findUnique({
              where: { xeroTransactionId: tx.bankTransactionID }
            });
            
            await prisma.bankTransaction.upsert({
              where: { xeroTransactionId: tx.bankTransactionID },
              update: {
                bankAccountId: dbAccount.id,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                status: tx.status?.toString() || 'AUTHORISED',
                isReconciled: tx.isReconciled || false,
                reference: tx.reference || null,
                description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
                contactName: tx.contact?.name || null,
                lineItems: lineItemsJson,
                hasAttachments: tx.hasAttachments || false,
                lastSyncedAt: new Date()
              },
              create: {
                xeroTransactionId: tx.bankTransactionID,
                bankAccountId: dbAccount.id,
                date: new Date(tx.date || new Date()),
                amount: tx.total || 0,
                currencyCode: tx.currencyCode?.toString() || account.currencyCode?.toString() || null,
                type: tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND',
                status: tx.status?.toString() || 'AUTHORISED',
                isReconciled: tx.isReconciled || false,
                reference: tx.reference || null,
                description: tx.reference || tx.lineItems?.[0]?.description || tx.contact?.name || null,
                contactName: tx.contact?.name || null,
                lineItems: lineItemsJson,
                hasAttachments: tx.hasAttachments || false
              }
            });
            
            if (existing) {
              updatedTransactions++;
            } else {
              createdTransactions++;
            }
            
            accountTransactions++;
            totalTransactions++;
          }
          
          page++;
          
          // If we got less than 100, we're on the last page
          if (transactions.length < 100) {
            hasMorePages = false;
          }
        } catch (pageError: any) {
          console.error(`Error fetching page ${page} for ${account.name}:`, pageError.message);
          hasMorePages = false;
        }
      }
      
      console.log(`  Total for ${account.name}: ${accountTransactions} transactions`);
    }
    
    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated: createdTransactions,
        recordsUpdated: updatedTransactions,
        details: JSON.stringify({
          accounts: totalAccounts,
          transactions: totalTransactions,
          bankAccountBreakdown: await prisma.bankTransaction.groupBy({
            by: ['bankAccountId'],
            _count: true
          })
        })
      }
    });
    
    console.log('\nSync completed successfully!');
    console.log(`Total accounts: ${totalAccounts}`);
    console.log(`Total transactions: ${totalTransactions}`);
    console.log(`Created: ${createdTransactions}, Updated: ${updatedTransactions}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        accounts: totalAccounts,
        transactions: totalTransactions,
        created: createdTransactions,
        updated: updatedTransactions
      }
    });
    
  } catch (error: any) {
    console.error('Sync error:', error);
    
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

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  try {
    const lastSync = await prisma.syncLog.findFirst({
      where: { syncType: 'full_sync' },
      orderBy: { startedAt: 'desc' }
    });
    
    const stats = await prisma.bankTransaction.aggregate({
      _count: true,
      _sum: { amount: true }
    });
    
    const accountStats = await prisma.bankAccount.count();
    
    const unreconciledCount = await prisma.bankTransaction.count({
      where: { isReconciled: false }
    });
    
    return NextResponse.json({
      lastSync,
      stats: {
        totalAccounts: accountStats,
        totalTransactions: stats._count,
        totalAmount: stats._sum.amount,
        unreconciledCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get sync status',
      message: error.message
    }, { status: 500 });
  }
}
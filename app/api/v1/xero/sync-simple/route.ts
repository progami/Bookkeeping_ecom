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
    
    // Get accounts
    const accountsResp = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    const accounts = accountsResp.body.accounts || [];
    
    // Create account map
    const accountMap = new Map();
    for (const acc of accounts) {
      if (!acc.accountID) continue;
      
      // First check if account exists
      let dbAcc = await prisma.bankAccount.findUnique({
        where: { xeroAccountId: acc.accountID }
      });
      
      if (!dbAcc) {
        dbAcc = await prisma.bankAccount.create({
          data: {
            xeroAccountId: acc.accountID,
            name: acc.name || '',
            currencyCode: acc.currencyCode?.toString() || null
          }
        });
      }
      
      accountMap.set(acc.accountID, dbAcc.id);
    }
    
    // Get ALL transactions - we know this returns 3276
    const response = await xero.accountingApi.getBankTransactions(tenant.tenantId);
    const allTransactions = response.body.bankTransactions || [];
    
    console.log(`Got ${allTransactions.length} transactions from Xero`);
    
    // Delete existing transactions to start fresh
    await prisma.bankTransaction.deleteMany({});
    console.log('Cleared existing transactions');
    
    // Save all transactions using createMany for better performance
    const transactionsToCreate = [];
    
    for (const tx of allTransactions) {
      if (!tx.bankTransactionID || !tx.bankAccount?.accountID) continue;
      
      const dbAccountId = accountMap.get(tx.bankAccount.accountID);
      if (!dbAccountId) continue;
      
      transactionsToCreate.push({
        xeroTransactionId: tx.bankTransactionID,
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
      });
    }
    
    console.log(`Prepared ${transactionsToCreate.length} transactions for insert`);
    
    // Insert all at once
    const result = await prisma.bankTransaction.createMany({
      data: transactionsToCreate
    });
    
    console.log(`Inserted ${result.count} transactions`);
    
    // Get final count
    const totalInDb = await prisma.bankTransaction.count();
    
    // Get breakdown
    const accountStats = await prisma.bankTransaction.groupBy({
      by: ['bankAccountId'],
      _count: true
    });
    
    const breakdown = [];
    for (const stat of accountStats) {
      const account = await prisma.bankAccount.findUnique({
        where: { id: stat.bankAccountId }
      });
      if (account) {
        breakdown.push({
          account: account.name,
          currency: account.currencyCode,
          count: stat._count
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        receivedFromXero: allTransactions.length,
        preparedForInsert: transactionsToCreate.length,
        inserted: result.count,
        totalInDatabase: totalInDb
      },
      accountBreakdown: breakdown.sort((a, b) => b.count - a.count)
    });
    
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
      details: error.stack
    }, { status: 500 });
  }
}
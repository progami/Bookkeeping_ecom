import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { BankTransaction } from 'xero-node';
import { matchTransactions } from '@/lib/transaction-matcher';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      return NextResponse.json(
        { error: 'Not connected to Xero' },
        { status: 401 }
      );
    }
    
    // Get the active tenant
    await xero.updateTenants();
    const activeTenant = xero.tenants[0];
    
    if (!activeTenant) {
      return NextResponse.json(
        { error: 'No active tenant' },
        { status: 400 }
      );
    }
    
    // Fetch unreconciled bank transactions
    const response = await xero.accountingApi.getBankTransactions(
      activeTenant.tenantId,
      undefined, // If-Modified-Since
      'Status=="UNMATCHED"', // where filter for unreconciled
      'Date DESC', // order by
      100, // page size
      undefined, // unitdp
      1 // page number
    );
    
    // Transform transactions for frontend
    const rawTransactions = response.body.bankTransactions?.map(tx => ({
      id: tx.bankTransactionID || '',
      date: tx.date || new Date().toISOString(),
      amount: tx.total || 0,
      description: tx.reference || tx.contact?.name || 'No description',
      type: (tx.type === BankTransaction.TypeEnum.RECEIVE ? 'RECEIVE' : 'SPEND') as 'SPEND' | 'RECEIVE',
      status: 'unreconciled' as const,
      bankAccountId: tx.bankAccount?.accountID,
      bankAccountName: tx.bankAccount?.name,
      contact: tx.contact?.name,
      reference: tx.reference,
      isReconciled: tx.isReconciled || false,
      hasAttachments: tx.hasAttachments,
      lineItems: tx.lineItems
    })) || [];
    
    // Match transactions with rules
    const matchedTransactions = await matchTransactions(rawTransactions);
    
    return NextResponse.json({
      transactions: matchedTransactions,
      pagination: {
        page: 1,
        pageSize: 100,
        total: matchedTransactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      return NextResponse.json(
        { error: 'Not connected to Xero' },
        { status: 401 }
      );
    }
    
    const { transactionId, updates } = await request.json();
    
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      );
    }
    
    // Get the active tenant
    await xero.updateTenants();
    const activeTenant = xero.tenants[0];
    
    if (!activeTenant) {
      return NextResponse.json(
        { error: 'No active tenant' },
        { status: 400 }
      );
    }
    
    // Update the transaction
    const bankTransaction: BankTransaction = {
      bankTransactionID: transactionId,
      ...updates
    };
    
    const response = await xero.accountingApi.updateBankTransaction(
      activeTenant.tenantId,
      transactionId,
      { bankTransactions: [bankTransaction] }
    );
    
    return NextResponse.json({
      success: true,
      transaction: response.body.bankTransactions?.[0]
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
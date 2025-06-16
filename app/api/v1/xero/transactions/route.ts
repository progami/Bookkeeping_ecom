import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';
import { withValidation } from '@/lib/validation/middleware';
import { transactionsQuerySchema, transactionUpdateSchema } from '@/lib/validation/schemas';

export const GET = withValidation(
  { querySchema: transactionsQuerySchema },
  async (request, { query }) => {
  try {
    // Use validated query parameters with defaults
    const page = query?.page || 1;
    const pageSize = Math.min(query?.limit || 50, 10000); // Still limit to prevent performance issues
    const accountId = query?.accountId;
    const showReconciled = query?.status === 'RECONCILED' || query?.status === undefined;
    
    // Build where clause
    const where: any = {};
    
    // Filter by reconciliation status
    if (!showReconciled) {
      where.isReconciled = false;
    }
    
    // Filter by account if specified
    if (accountId) {
      const account = await prisma.bankAccount.findFirst({
        where: { xeroAccountId: accountId }
      });
      if (account) {
        where.bankAccountId = account.id;
      }
    }
    
    // Filter out deleted transactions
    where.status = { not: 'DELETED' };
    
    // Get total count for pagination
    const totalCount = await prisma.bankTransaction.count({ where });
    
    // Fetch GL accounts from database
    let glAccountMap = new Map<string, string>();
    try {
      // Get all GL accounts from our database
      const glAccounts = await prisma.gLAccount.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true, name: true }
      });
      
      // Build the map from database
      glAccounts.forEach(acc => {
        glAccountMap.set(acc.code, acc.name);
      });
      
      console.log(`Loaded ${glAccounts.length} GL accounts from database`);
      
      // If no accounts in database, try to sync from Xero
      if (glAccounts.length === 0) {
        console.warn('No GL accounts in database, using fallback mapping');
        
        // Fallback mapping for demo purposes
        const fallbackAccounts = new Map([
          ['200', 'Sales'],
          ['310', 'Cost of Goods Sold'],
          ['400', 'Advertising'],
          ['404', 'Bank Fees'],
          ['408', 'Cleaning'],
          ['412', 'Consulting & Accounting'],
          ['420', 'Entertainment'],
          ['429', 'General Expenses'],
          ['433', 'Insurance'],
          ['445', 'Light, Power, Heating'],
          ['453', 'Office Expenses'],
          ['461', 'Printing & Stationery'],
          ['469', 'Rent'],
          ['477', 'Salaries'],
          ['485', 'Subscriptions'],
          ['489', 'Telephone & Internet'],
          ['493', 'Travel - National'],
          ['500', 'Corporation Tax']
        ]);
        
        fallbackAccounts.forEach((name, code) => {
          glAccountMap.set(code, name);
        });
      }
    } catch (error) {
      console.error('Error fetching GL accounts from database:', error);
    }
    
    // Fetch transactions with bank account info
    const transactions = await prisma.bankTransaction.findMany({
      where,
      include: {
        bankAccount: true
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    
    // Transform for frontend
    const transformedTransactions = transactions.map(tx => {
      let accountCode = tx.accountCode;
      let accountName = undefined;
      
      // Try to get account code from line items if not set
      if (!accountCode && tx.lineItems) {
        try {
          const lineItems = JSON.parse(tx.lineItems);
          if (lineItems.length > 0 && lineItems[0].accountCode) {
            accountCode = lineItems[0].accountCode;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      // Get account name from map
      if (accountCode && glAccountMap.has(accountCode)) {
        accountName = glAccountMap.get(accountCode);
      }
      
      // Debug first few transactions
      if (transactions.indexOf(tx) < 3 && accountCode) {
        console.log(`Transaction ${tx.xeroTransactionId.substring(0, 8)}: accountCode=${accountCode}, accountName=${accountName}, mapSize=${glAccountMap.size}`);
        // Extra debug - check if code exists in map
        if (!glAccountMap.has(accountCode)) {
          console.log(`  WARNING: Code ${accountCode} not found in GL map!`);
          // Show first few entries in the map
          if (transactions.indexOf(tx) === 0) {
            console.log('  First 5 GL map entries:');
            let count = 0;
            glAccountMap.forEach((name, code) => {
              if (count < 5) {
                console.log(`    ${code}: ${name}`);
                count++;
              }
            });
          }
        }
      }
      
      return {
        id: tx.xeroTransactionId,
        date: tx.date.toISOString(),
        amount: tx.amount,
        description: (() => {
          // Priority: non-default description > reference > contact name > default
          if (tx.description && tx.description.trim() !== '' && tx.description !== 'Bank Transaction') {
            return tx.description;
          }
          if (tx.reference && tx.reference.trim() !== '') {
            return tx.reference;
          }
          if (tx.contactName && tx.contactName.trim() !== '') {
            return tx.contactName;
          }
          return 'Bank Transaction';
        })(),
        type: tx.type as 'SPEND' | 'RECEIVE',
        status: (tx.isReconciled ? 'reconciled' : 'unreconciled') as 'reconciled' | 'unreconciled',
        bankAccountId: tx.bankAccount.xeroAccountId,
        bankAccountName: tx.bankAccount.name,
        currencyCode: tx.currencyCode || tx.bankAccount.currencyCode || 'GBP',
        contact: tx.contactName || undefined,
        contactId: null,
        contactName: tx.contactName || null,
        reference: tx.reference || null,
        isReconciled: tx.isReconciled,
        hasAttachments: tx.hasAttachments,
        lineItems: tx.lineItems ? JSON.parse(tx.lineItems) : undefined,
        accountCode: accountCode || undefined,
        accountName: accountName || undefined,
        taxType: tx.taxType || undefined
      };
    });
    
    // Since rules have been removed, we'll just use transformedTransactions directly
    const matchedTransactions = transformedTransactions;
    
    // Get bank accounts for filter
    const bankAccounts = await prisma.bankAccount.findMany({
      select: {
        xeroAccountId: true,
        name: true,
        currencyCode: true,
        _count: {
          select: { transactions: true }
        }
      }
    });
    
    // Get summary statistics for ALL transactions (not just current page)
    const [totalTransactions, unreconciledCount, reconciledCount] = await Promise.all([
      prisma.bankTransaction.count({ where: { status: { not: 'DELETED' } } }),
      prisma.bankTransaction.count({ 
        where: { 
          isReconciled: false,
          status: { not: 'DELETED' }
        } 
      }),
      prisma.bankTransaction.count({ 
        where: { 
          isReconciled: true,
          status: { not: 'DELETED' }
        } 
      })
    ]);
    
    return NextResponse.json({
      transactions: matchedTransactions,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      },
      bankAccounts: bankAccounts.map(acc => ({
        id: acc.xeroAccountId,
        name: acc.name,
        currencyCode: acc.currencyCode,
        transactionCount: acc._count.transactions
      })),
      summary: {
        totalTransactions,
        unreconciledCount,
        reconciledCount,
        matchedCount: 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error.message 
      },
      { status: 500 }
    );
  }
});

export const PUT = withValidation(
  { bodySchema: transactionUpdateSchema },
  async (request, { body }) => {
  try {
    const { transactionId, updates } = body!;
    
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID required' },
        { status: 400 }
      );
    }
    
    // Update transaction in database
    const transaction = await prisma.bankTransaction.update({
      where: { xeroTransactionId: transactionId },
      data: {
        accountCode: updates.accountCode,
        taxType: updates.taxType,
        description: updates.description,
        reference: updates.reference,
        isReconciled: updates.isReconciled || false,
        updatedAt: new Date()
      }
    });
    
    // TODO: Also update in Xero if needed
    
    return NextResponse.json({
      success: true,
      transaction
    });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
});
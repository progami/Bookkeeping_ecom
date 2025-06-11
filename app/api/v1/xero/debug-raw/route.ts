import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get the raw response
    console.log('Fetching raw bank transactions...');
    const response = await xero.accountingApi.getBankTransactions(tenant.tenantId);
    
    const transactions = response.body.bankTransactions || [];
    
    // Analyze the response
    const analysis = {
      totalCount: transactions.length,
      firstTransaction: transactions[0] ? {
        id: transactions[0].bankTransactionID,
        date: transactions[0].date,
        account: transactions[0].bankAccount?.name,
        amount: transactions[0].total
      } : null,
      lastTransaction: transactions[transactions.length - 1] ? {
        id: transactions[transactions.length - 1].bankTransactionID,
        date: transactions[transactions.length - 1].date,
        account: transactions[transactions.length - 1].bankAccount?.name,
        amount: transactions[transactions.length - 1].total
      } : null,
      accountBreakdown: {},
      dateRange: {
        earliest: null,
        latest: null
      }
    };
    
    // Count transactions per account
    const accountCounts: Record<string, number> = {};
    let earliestDate = new Date();
    let latestDate = new Date(0);
    
    for (const tx of transactions) {
      const accountName = tx.bankAccount?.name || 'Unknown';
      accountCounts[accountName] = (accountCounts[accountName] || 0) + 1;
      
      if (tx.date) {
        const txDate = new Date(tx.date);
        if (txDate < earliestDate) earliestDate = txDate;
        if (txDate > latestDate) latestDate = txDate;
      }
    }
    
    (analysis as any).accountBreakdown = accountCounts;
    (analysis as any).dateRange = {
      earliest: earliestDate.toISOString(),
      latest: latestDate.toISOString()
    };
    
    // Sample some transactions from different positions
    const samples = [];
    if (transactions.length > 0) {
      // First 5
      for (let i = 0; i < Math.min(5, transactions.length); i++) {
        samples.push({
          position: i,
          id: transactions[i].bankTransactionID,
          date: transactions[i].date,
          account: transactions[i].bankAccount?.name,
          amount: transactions[i].total
        });
      }
      
      // Middle 5
      const midStart = Math.floor(transactions.length / 2) - 2;
      for (let i = midStart; i < Math.min(midStart + 5, transactions.length); i++) {
        if (i >= 0 && i < transactions.length) {
          samples.push({
            position: i,
            id: transactions[i].bankTransactionID,
            date: transactions[i].date,
            account: transactions[i].bankAccount?.name,
            amount: transactions[i].total
          });
        }
      }
      
      // Last 5
      for (let i = Math.max(0, transactions.length - 5); i < transactions.length; i++) {
        samples.push({
          position: i,
          id: transactions[i].bankTransactionID,
          date: transactions[i].date,
          account: transactions[i].bankAccount?.name,
          amount: transactions[i].total
        });
      }
    }
    
    return NextResponse.json({
      analysis,
      samples,
      rawResponseLength: JSON.stringify(response.body).length,
      message: `Xero returned ${transactions.length} transactions in the raw API call`
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug failed',
      message: error.message
    }, { status: 500 });
  }
}
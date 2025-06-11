import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

// This endpoint tests different pagination strategies to find all transactions
export async function GET(request: NextRequest) {
  const results: any[] = [];
  
  try {
    const xero = await getXeroClient();
    
    if (!xero) {
      // If not connected, provide instructions
      return NextResponse.json({
        error: 'Not connected to Xero',
        instructions: [
          '1. Visit http://localhost:3003/api/v1/xero/auth',
          '2. Log in to Xero and authorize the app',
          '3. You should be redirected back to the bookkeeping page',
          '4. Check if you see "connected=true" in the URL',
          '5. Then try this endpoint again'
        ],
        debugInfo: {
          authUrl: 'http://localhost:3003/api/v1/xero/auth',
          callbackUrl: 'http://localhost:3003/api/v1/xero/auth/callback',
          expectedRedirect: 'http://localhost:3003/bookkeeping?connected=true'
        }
      });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    results.push({
      step: 'Connected',
      tenant: tenant.tenantName
    });
    
    // Test 1: Check what happens with different date ranges
    const dateTests = [
      { name: 'Last 30 days', days: 30 },
      { name: 'Last 90 days', days: 90 },
      { name: 'Last 365 days', days: 365 },
      { name: 'Last 730 days (2 years)', days: 730 }
    ];
    
    for (const test of dateTests) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - test.days);
      
      try {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          `Date >= DateTime(${fromDate.toISOString().split('T')[0]}T00:00:00)`,
          'Date DESC',
          100,
          undefined,
          1
        );
        
        results.push({
          test: test.name,
          fromDate: fromDate.toISOString().split('T')[0],
          transactionCount: response.body.bankTransactions?.length || 0,
          hasMore: (response.body.bankTransactions?.length || 0) >= 100
        });
      } catch (error: any) {
        results.push({
          test: test.name,
          error: error.message
        });
      }
    }
    
    // Test 2: Try to get total count by fetching all pages
    let allTransactionIds = new Set();
    let page = 1;
    const maxPages = 20; // Limit for testing
    
    results.push({ step: 'Fetching all pages (up to 20)...' });
    
    while (page <= maxPages) {
      try {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          undefined, // No filter
          'Date DESC',
          100,
          undefined,
          page
        );
        
        const transactions = response.body.bankTransactions || [];
        
        if (transactions.length === 0 && page > 1) {
          // Try one more page in case of gaps
          page++;
          continue;
        }
        
        for (const tx of transactions) {
          if (tx.bankTransactionID) {
            allTransactionIds.add(tx.bankTransactionID);
          }
        }
        
        results.push({
          page,
          transactionsOnPage: transactions.length,
          totalUniqueSoFar: allTransactionIds.size
        });
        
        if (transactions.length < 100 && transactions.length > 0) {
          results.push({ note: 'Reached last page (less than 100 transactions)' });
          break;
        }
        
        if (transactions.length === 0 && page > 5) {
          results.push({ note: 'No more transactions found' });
          break;
        }
        
        page++;
      } catch (error: any) {
        results.push({
          page,
          error: error.message
        });
        break;
      }
    }
    
    results.push({
      summary: {
        totalUniqueTransactions: allTransactionIds.size,
        pagesChecked: page - 1
      }
    });
    
    return NextResponse.json({
      success: true,
      results
    });
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Test failed',
      message: error.message,
      results
    }, { status: 500 });
  }
}
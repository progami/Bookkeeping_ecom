import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return new Response('Not connected to Xero', { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    let html = `
      <html>
        <body style="font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff;">
          <h1>AGGRESSIVE Transaction Fetch</h1>
          <p>Connected to: ${tenant.tenantName}</p>
          <pre id="log" style="background: #000; padding: 10px; border-radius: 5px;"></pre>
          <script>
            const log = document.getElementById('log');
            function addLog(msg) {
              log.textContent += msg + '\\n';
              window.scrollTo(0, document.body.scrollHeight);
            }
          </script>
    `;
    
    const allTransactions = new Map();
    
    // Get accounts first
    const accountsResp = await xero.accountingApi.getAccounts(tenant.tenantId, undefined, 'Type=="BANK"');
    const accounts = accountsResp.body.accounts || [];
    html += `<script>addLog('Found ${accounts.length} bank accounts');</script>`;
    
    // Save accounts
    const accountMap = new Map();
    for (const acc of accounts) {
      if (!acc.accountID) continue;
      const dbAcc = await prisma.bankAccount.upsert({
        where: { xeroAccountId: acc.accountID },
        update: { name: acc.name || '', currencyCode: acc.currencyCode?.toString() || null },
        create: { xeroAccountId: acc.accountID, name: acc.name || '', currencyCode: acc.currencyCode?.toString() || null }
      });
      accountMap.set(acc.accountID, dbAcc.id);
      html += `<script>addLog('  - ${acc.name} (${acc.currencyCode})');</script>`;
    }
    
    // STRATEGY 1: Get each account's transactions individually
    html += `<script>addLog('\\n=== STRATEGY 1: Per-Account Fetch ===');</script>`;
    
    for (const account of accounts) {
      if (!account.accountID) continue;
      
      html += `<script>addLog('\\nFetching ${account.name}...');</script>`;
      
      let accountTxCount = 0;
      
      // Try multiple page ranges for EACH account
      for (let startPage = 1; startPage <= 100; startPage += 10) {
        try {
          const response = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined,
            `BankAccount.AccountID=Guid("${account.accountID}")`,
            undefined, // No order
            100,
            undefined,
            startPage
          );
          
          const txs = response.body.bankTransactions || [];
          
          if (txs.length > 0) {
            html += `<script>addLog('  Page ${startPage}: ${txs.length} transactions');</script>`;
            
            txs.forEach(tx => {
              if (tx.bankTransactionID) {
                allTransactions.set(tx.bankTransactionID, tx);
                accountTxCount++;
              }
            });
            
            // If we found transactions, check surrounding pages
            for (let nearPage = startPage - 2; nearPage <= startPage + 5; nearPage++) {
              if (nearPage < 1 || nearPage === startPage) continue;
              
              try {
                const nearResp = await xero.accountingApi.getBankTransactions(
                  tenant.tenantId,
                  undefined,
                  `BankAccount.AccountID=Guid("${account.accountID}")`,
                  undefined,
                  100,
                  undefined,
                  nearPage
                );
                
                const nearTxs = nearResp.body.bankTransactions || [];
                if (nearTxs.length > 0) {
                  html += `<script>addLog('    Nearby page ${nearPage}: ${nearTxs.length} transactions');</script>`;
                  nearTxs.forEach(tx => {
                    if (tx.bankTransactionID) {
                      allTransactions.set(tx.bankTransactionID, tx);
                      accountTxCount++;
                    }
                  });
                }
              } catch (e) {
                // Skip errors
              }
            }
          }
        } catch (e: any) {
          // Skip errors
        }
      }
      
      html += `<script>addLog('  Total for ${account.name}: ${accountTxCount} transactions');</script>`;
    }
    
    html += `<script>addLog('\\nTotal after Strategy 1: ${allTransactions.size} unique transactions');</script>`;
    
    // STRATEGY 2: Date-based queries
    html += `<script>addLog('\\n=== STRATEGY 2: Date Range Queries ===');</script>`;
    
    const dateRanges = [
      { days: 30, name: 'Last 30 days' },
      { days: 90, name: 'Last 90 days' },
      { days: 180, name: 'Last 180 days' },
      { days: 365, name: 'Last year' },
      { days: 730, name: 'Last 2 years' },
      { days: 1825, name: 'Last 5 years' }
    ];
    
    for (const range of dateRanges) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - range.days);
      
      try {
        html += `<script>addLog('\\nTrying ${range.name}...');</script>`;
        
        let page = 1;
        let rangeCount = 0;
        
        while (page <= 20) {
          const response = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined,
            `Date >= DateTime(${fromDate.toISOString().split('T')[0]}T00:00:00)`,
            undefined,
            100,
            undefined,
            page
          );
          
          const txs = response.body.bankTransactions || [];
          
          if (txs.length === 0) break;
          
          txs.forEach(tx => {
            if (tx.bankTransactionID && !allTransactions.has(tx.bankTransactionID)) {
              allTransactions.set(tx.bankTransactionID, tx);
              rangeCount++;
            }
          });
          
          html += `<script>addLog('  Page ${page}: ${txs.length} transactions (${rangeCount} new)');</script>`;
          
          if (txs.length < 100) break;
          page++;
        }
      } catch (e: any) {
        html += `<script>addLog('  Error: ${e.message}');</script>`;
      }
    }
    
    html += `<script>addLog('\\nTotal after Strategy 2: ${allTransactions.size} unique transactions');</script>`;
    
    // STRATEGY 3: Try without ANY filters
    html += `<script>addLog('\\n=== STRATEGY 3: No Filters (Raw) ===');</script>`;
    
    try {
      // Try pages 1-100 but skip in intervals
      for (let page = 1; page <= 100; page += 5) {
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          undefined,
          undefined,
          100,
          undefined,
          page
        );
        
        const txs = response.body.bankTransactions || [];
        
        if (txs.length > 0) {
          html += `<script>addLog('Page ${page}: ${txs.length} transactions');</script>`;
          
          txs.forEach(tx => {
            if (tx.bankTransactionID) {
              allTransactions.set(tx.bankTransactionID, tx);
            }
          });
          
          // Check nearby pages if we found something
          for (let near = page - 2; near < page + 3; near++) {
            if (near < 1 || near === page || near > 100) continue;
            
            try {
              const nearResp = await xero.accountingApi.getBankTransactions(
                tenant.tenantId, undefined, undefined, undefined, 100, undefined, near
              );
              const nearTxs = nearResp.body.bankTransactions || [];
              
              if (nearTxs.length > 0) {
                html += `<script>addLog('  Checking nearby page ${near}: ${nearTxs.length} found');</script>`;
                nearTxs.forEach(tx => {
                  if (tx.bankTransactionID) allTransactions.set(tx.bankTransactionID, tx);
                });
              }
            } catch (e) {
              // Skip
            }
          }
        }
      }
    } catch (e: any) {
      html += `<script>addLog('Strategy 3 error: ${e.message}');</script>`;
    }
    
    html += `<script>addLog('\\nTotal after Strategy 3: ${allTransactions.size} unique transactions');</script>`;
    
    // Save all to database
    html += `<script>addLog('\\n=== SAVING TO DATABASE ===');</script>`;
    
    let saved = 0, updated = 0, errors = 0;
    
    for (const [id, tx] of allTransactions) {
      if (!tx.bankAccount?.accountID) continue;
      const dbAccountId = accountMap.get(tx.bankAccount.accountID);
      if (!dbAccountId) continue;
      
      try {
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
    
    const totalInDb = await prisma.bankTransaction.count();
    
    html += `
          <script>
            addLog('\\n=== FINAL RESULTS ===');
            addLog('Found in Xero: ${allTransactions.size} unique transactions');
            addLog('Newly saved: ${saved}');
            addLog('Updated: ${updated}');
            addLog('Errors: ${errors}');
            addLog('\\nTOTAL IN DATABASE: ${totalInDb}');
            addLog('\\n✅ SYNC COMPLETE!');
          </script>
          <hr>
          <div style="margin-top: 20px;">
            <a href="/bookkeeping/transactions" style="color: #10b981;">View All Transactions</a>
          </div>
        </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error: any) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
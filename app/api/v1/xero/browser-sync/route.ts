import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  // This endpoint is designed to be called from the browser
  // Just visit: http://localhost:3003/api/v1/xero/browser-sync
  
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return new Response(`
        <html>
          <body style="font-family: monospace; padding: 20px;">
            <h1>Not Connected to Xero</h1>
            <p>Please <a href="/api/v1/xero/auth">connect to Xero</a> first.</p>
          </body>
        </html>
      `, { 
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    let html = `
      <html>
        <body style="font-family: monospace; padding: 20px;">
          <h1>Fetching ALL Transactions from Xero</h1>
          <p>Connected to: ${tenant.tenantName}</p>
          <pre id="log"></pre>
          <script>
            const log = document.getElementById('log');
            log.textContent = 'Starting sync...\\n';
          </script>
    `;
    
    // Get all bank accounts
    const accountsResp = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      'Type=="BANK"'
    );
    const accounts = accountsResp.body.accounts || [];
    
    html += `<script>log.textContent += 'Found ${accounts.length} bank accounts\\n';</script>`;
    
    // Save accounts to DB
    const accountMap = new Map();
    for (const acc of accounts) {
      if (!acc.accountID) continue;
      const dbAcc = await prisma.bankAccount.upsert({
        where: { xeroAccountId: acc.accountID },
        update: { name: acc.name || '', currencyCode: acc.currencyCode?.toString() || null },
        create: { xeroAccountId: acc.accountID, name: acc.name || '', currencyCode: acc.currencyCode?.toString() || null }
      });
      accountMap.set(acc.accountID, dbAcc.id);
    }
    
    // Fetch ALL transactions with multiple strategies
    const allTx = new Map();
    
    // Try raw fetch first
    html += `<script>log.textContent += '\\nFetching all transactions (no filters)...\\n';</script>`;
    
    for (let page = 1; page <= 50; page++) {
      try {
        const resp = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined,
          undefined,
          undefined,
          100,
          undefined,
          page
        );
        const txs = resp.body.bankTransactions || [];
        
        if (txs.length === 0 && page > 5) break;
        
        txs.forEach(tx => {
          if (tx.bankTransactionID) allTx.set(tx.bankTransactionID, tx);
        });
        
        html += `<script>log.textContent += 'Page ${page}: ${txs.length} transactions (Total unique: ${allTx.size})\\n';</script>`;
        
        if (txs.length < 100 && txs.length > 0) break;
      } catch (e: any) {
        html += `<script>log.textContent += 'Error on page ${page}: ${e.message}\\n';</script>`;
        break;
      }
    }
    
    // Save to database
    let saved = 0, updated = 0;
    for (const [id, tx] of allTx) {
      if (!tx.bankAccount?.accountID) continue;
      const dbAccountId = accountMap.get(tx.bankAccount.accountID);
      if (!dbAccountId) continue;
      
      try {
        const existing = await prisma.bankTransaction.findUnique({
          where: { xeroTransactionId: id }
        });
        
        await prisma.bankTransaction.upsert({
          where: { xeroTransactionId: id },
          update: { lastSyncedAt: new Date() },
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
      } catch (e) {
        // Skip errors
      }
    }
    
    const totalInDb = await prisma.bankTransaction.count();
    
    html += `
          <script>
            log.textContent += '\\n=== SYNC COMPLETE ===\\n';
            log.textContent += 'Found in Xero: ${allTx.size} transactions\\n';
            log.textContent += 'Saved: ${saved}\\n';
            log.textContent += 'Updated: ${updated}\\n';
            log.textContent += 'Total in database: ${totalInDb}\\n';
          </script>
          <hr>
          <a href="/bookkeeping/transactions">View Transactions</a>
        </body>
      </html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
    
  } catch (error: any) {
    return new Response(`
      <html>
        <body style="font-family: monospace; padding: 20px;">
          <h1>Error</h1>
          <pre>${error.message}</pre>
        </body>
      </html>
    `, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
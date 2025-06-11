import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';

export async function POST(request: NextRequest) {
  try {
    const xero = await getXeroClient();
    if (!xero) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    console.log('Starting sync with line items...');
    
    // Get all bank accounts
    const bankAccounts = await prisma.bankAccount.findMany();
    let totalUpdated = 0;
    let totalWithAccountCodes = 0;
    
    for (const account of bankAccounts) {
      console.log(`\nSyncing ${account.name}...`);
      
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        try {
          // Fetch transactions with full details including line items
          const response = await xero.accountingApi.getBankTransactions(
            tenant.tenantId,
            undefined, // If-Modified-Since
            `BankAccount.AccountID=Guid("${account.xeroAccountId}")`, // where
            'Date DESC', // order
            100, // page size
            (page - 1) * 100 // offset
          );
          
          const transactions = response.body.bankTransactions || [];
          
          if (transactions.length === 0) {
            hasMore = false;
            break;
          }
          
          // Update each transaction with line item details
          for (const xeroTx of transactions) {
            try {
              // Extract account code and build line items
              let accountCode = null;
              let lineItems: any[] = [];
              
              if (xeroTx.lineItems && xeroTx.lineItems.length > 0) {
                // Get the first line item's account code (most transactions have only one)
                accountCode = xeroTx.lineItems[0].accountCode || null;
                
                lineItems = xeroTx.lineItems.map(li => ({
                  lineItemID: li.lineItemID,
                  description: li.description,
                  quantity: li.quantity || 1,
                  unitAmount: li.unitAmount || 0,
                  accountCode: li.accountCode,
                  taxType: li.taxType,
                  lineAmount: li.lineAmount || 0
                }));
                
                if (accountCode) {
                  totalWithAccountCodes++;
                }
              }
              
              // Build better description
              const description = xeroTx.lineItems?.[0]?.description || 
                                xeroTx.reference || 
                                xeroTx.contact?.name || 
                                'Bank Transaction';
              
              // Update the transaction
              await prisma.bankTransaction.update({
                where: { xeroTransactionId: xeroTx.bankTransactionID },
                data: {
                  description: description,
                  reference: xeroTx.reference || null,
                  contactName: xeroTx.contact?.name || null,
                  accountCode: accountCode,
                  lineItems: JSON.stringify(lineItems),
                  taxType: xeroTx.lineItems?.[0]?.taxType || null,
                  isReconciled: xeroTx.isReconciled || false,
                  lastSyncedAt: new Date()
                }
              });
              
              totalUpdated++;
              
              if (totalUpdated % 100 === 0) {
                console.log(`Updated ${totalUpdated} transactions...`);
              }
            } catch (error) {
              console.error(`Error updating transaction ${xeroTx.bankTransactionID}:`, error);
            }
          }
          
          page++;
          
          // Limit pages to avoid timeout
          if (page > 10) {
            console.log('Reached page limit for this account');
            hasMore = false;
          }
        } catch (error) {
          console.error(`Error fetching page ${page} for ${account.name}:`, error);
          hasMore = false;
        }
      }
    }
    
    // Get updated statistics
    const [totalTransactions, withAccountCodes] = await Promise.all([
      prisma.bankTransaction.count(),
      prisma.bankTransaction.count({ where: { accountCode: { not: null } } })
    ]);
    
    const result = {
      success: true,
      message: 'Sync completed with line items',
      stats: {
        totalUpdated,
        totalWithAccountCodes,
        totalTransactions,
        withAccountCodes,
        percentageWithCodes: ((withAccountCodes / totalTransactions) * 100).toFixed(1) + '%'
      }
    };
    
    console.log('Sync complete:', result);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message
    }, { status: 500 });
  }
}
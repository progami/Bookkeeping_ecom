import { prisma } from '../lib/prisma';
import { getXeroClient } from '../lib/xero-client';

async function resyncTransactionsWithGL() {
  try {
    console.log('Re-syncing transactions with GL account data from Xero...\n');
    
    const xero = await getXeroClient();
    if (!xero) {
      console.error('Not connected to Xero');
      return;
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // First, make sure we have GL accounts synced
    const glAccountCount = await prisma.gLAccount.count();
    if (glAccountCount === 0) {
      console.log('No GL accounts in database. Please sync GL accounts first.');
      return;
    }
    
    console.log(`Found ${glAccountCount} GL accounts in database`);
    
    // Get bank accounts
    const bankAccounts = await prisma.bankAccount.findMany();
    console.log(`\nProcessing ${bankAccounts.length} bank accounts...`);
    
    let totalUpdated = 0;
    let totalErrors = 0;
    
    for (const account of bankAccounts) {
      console.log(`\nFetching transactions for ${account.name}...`);
      
      try {
        // Fetch transactions from Xero with full details
        const response = await xero.accountingApi.getBankTransactions(
          tenant.tenantId,
          undefined, // If-Modified-Since
          `BankAccount.AccountID=Guid("${account.xeroAccountId}")`, // where
          'Date DESC', // order
          100, // page size
          0 // offset
        );
        
        const xeroTransactions = response.body.bankTransactions || [];
        console.log(`Found ${xeroTransactions.length} transactions in Xero`);
        
        for (const xeroTx of xeroTransactions) {
          try {
            // Extract GL account code from line items
            let accountCode = null;
            let lineItems: any[] = [];
            
            if (xeroTx.lineItems && xeroTx.lineItems.length > 0) {
              accountCode = xeroTx.lineItems[0].accountCode || null;
              lineItems = xeroTx.lineItems.map(li => ({
                lineItemID: li.lineItemID,
                description: li.description,
                quantity: li.quantity,
                unitAmount: li.unitAmount,
                accountCode: li.accountCode,
                taxType: li.taxType,
                lineAmount: li.lineAmount
              }));
            }
            
            // Build proper description
            let description = xeroTx.lineItems?.[0]?.description || 
                            xeroTx.reference || 
                            xeroTx.contact?.name || 
                            'Bank Transaction';
            
            // Update transaction in database
            await prisma.bankTransaction.update({
              where: { xeroTransactionId: xeroTx.bankTransactionID },
              data: {
                description: description,
                reference: xeroTx.reference || null,
                contactName: xeroTx.contact?.name || null,
                accountCode: accountCode,
                lineItems: JSON.stringify(lineItems),
                taxType: xeroTx.lineItems?.[0]?.taxType || null
              }
            });
            
            totalUpdated++;
            
            if (totalUpdated % 50 === 0) {
              console.log(`Updated ${totalUpdated} transactions...`);
            }
          } catch (error) {
            console.error(`Error updating transaction ${xeroTx.bankTransactionID}:`, error);
            totalErrors++;
          }
        }
      } catch (error) {
        console.error(`Error fetching transactions for account ${account.name}:`, error);
      }
    }
    
    console.log(`\n✅ Re-sync complete!`);
    console.log(`- Updated: ${totalUpdated} transactions`);
    console.log(`- Errors: ${totalErrors}`);
    
    // Show sample of updated transactions
    const samples = await prisma.bankTransaction.findMany({
      where: {
        accountCode: { not: null }
      },
      take: 5
    });
    
    console.log('\nSample updated transactions:');
    for (const tx of samples) {
      const glAccount = await prisma.gLAccount.findUnique({
        where: { code: tx.accountCode! }
      });
      console.log(`- ${tx.description} => ${tx.accountCode} (${glAccount?.name || 'Unknown'})`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resyncTransactionsWithGL();
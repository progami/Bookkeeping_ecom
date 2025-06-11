import { prisma } from '../lib/prisma';
import { getXeroClient } from '../lib/xero-client';

async function syncGLAccounts() {
  try {
    console.log('Syncing GL accounts from Xero...');
    
    const xero = await getXeroClient();
    if (!xero) {
      console.error('Not connected to Xero');
      return;
    }
    
    await xero.updateTenants();
    const tenant = xero.tenants[0];
    
    // Get all accounts (Chart of Accounts)
    const response = await xero.accountingApi.getAccounts(
      tenant.tenantId,
      undefined,
      undefined,
      'Code ASC'
    );

    const accounts = response.body.accounts || [];
    
    console.log(`Found ${accounts.length} GL accounts in Xero`);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const account of accounts) {
      try {
        // Skip accounts without codes
        if (!account.code) {
          console.warn(`Skipping account without code: ${account.name}`);
          continue;
        }

        // Upsert the account
        const result = await prisma.gLAccount.upsert({
          where: { code: account.code },
          update: {
            name: account.name || '',
            type: account.type?.toString() || 'OTHER',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims || false,
            enablePaymentsToAccount: account.enablePaymentsToAccount || false,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null,
            updatedAt: new Date()
          },
          create: {
            code: account.code,
            name: account.name || '',
            type: account.type?.toString() || 'OTHER',
            status: account.status?.toString() || 'ACTIVE',
            description: account.description || null,
            systemAccount: !!account.systemAccount,
            showInExpenseClaims: account.showInExpenseClaims || false,
            enablePaymentsToAccount: account.enablePaymentsToAccount || false,
            class: account._class?.toString() || null,
            reportingCode: account.reportingCode || null,
            reportingCodeName: account.reportingCodeName || null
          }
        });

        // Check if it was created or updated
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error(`Error processing account ${account.code}:`, error);
        errors++;
      }
    }

    console.log(`\nGL Accounts sync completed:`);
    console.log(`- Created: ${created}`);
    console.log(`- Updated: ${updated}`);
    console.log(`- Errors: ${errors}`);
    console.log(`- Total: ${accounts.length}`);

    // Show sample accounts
    const sampleAccounts = await prisma.gLAccount.findMany({
      take: 10,
      orderBy: { code: 'asc' }
    });

    console.log('\nSample GL accounts in database:');
    sampleAccounts.forEach(acc => {
      console.log(`  ${acc.code}: ${acc.name} (${acc.type})`);
    });

    // Check specific codes
    const specificCodes = ['200', '310', '453', '469', '477'];
    console.log('\nChecking specific account codes:');
    for (const code of specificCodes) {
      const account = await prisma.gLAccount.findUnique({
        where: { code }
      });
      if (account) {
        console.log(`  ${code}: ${account.name}`);
      } else {
        console.log(`  ${code}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    console.error('Error syncing GL accounts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncGLAccounts();